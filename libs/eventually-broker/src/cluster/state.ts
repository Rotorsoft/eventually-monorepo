import { dispose, log, singleton } from "@rotorsoft/eventually";
import cluster, { Worker } from "cluster";
import { cpus } from "os";
import { Writable } from "stream";
import {
  CommittableHttpStatus,
  ErrorMessage,
  EventsViewModel,
  RetryableHttpStatus
} from ".";
import { Operation, Service, Subscription, subscriptions } from "..";
import { refreshServiceSpec } from "../specs";
import { loop } from "../utils";
import { ServiceWithWorker, State, StateOptions } from "./interfaces";
import {
  WorkerConfig,
  SubscriptionState,
  SubscriptionViewModel,
  WorkerMessage
} from "./types";

export const toViewModel = (
  { id, active, path, position, endpointStatus, stats }: SubscriptionState,
  producer: Service,
  consumer: Service
): SubscriptionViewModel => {
  const emptyEventModel = (name: string, found: boolean): EventsViewModel => ({
    name,
    found,
    ok: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 },
    ignored: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 },
    retryable: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 },
    critical: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 }
  });
  const events =
    (consumer &&
      consumer.eventHandlers &&
      consumer.eventHandlers["/".concat(path)]?.refs) ||
    [];
  const eventsMap = events.reduce((map, name) => {
    map[name] = emptyEventModel(name, true);
    return map;
  }, {} as Record<string, EventsViewModel>);
  stats &&
    Object.entries(stats.events).map(([name, value]) => {
      const event = (eventsMap[name] =
        eventsMap[name] || emptyEventModel(name, false));
      event.ok = value[200];
      event.ignored = value[204];
      Object.entries(value).map(([status, stats]) => {
        if (CommittableHttpStatus.includes(+status)) return;
        const stat = RetryableHttpStatus.includes(+status)
          ? event.retryable
          : event.critical;
        stat.count += stats.count;
        stat.min = Math.min(stat.min, stats.min);
        stat.max = Math.max(stat.max, stats.max);
      });
    });
  const channelStatus = (producer && producer.status) || "";
  const channelPosition = (producer && producer.position) || -1;
  return {
    channelStatus,
    channelPosition,
    id,
    active,
    position,
    endpointStatus,
    total: stats?.total,
    events: Object.values(eventsMap)
  };
};

const MAX_RUNS = 10;
const RUN_RETRY_TIMEOUT = 10000;

export const state = singleton(function state(): State {
  const operationsLoop = loop("operations");
  const _services: Record<string, ServiceWithWorker> = {};
  const _timers: Record<string, NodeJS.Timeout> = {};
  const _sse: Record<string, { stream: Writable; id?: string }> = {};
  const _views: Record<string, SubscriptionViewModel> = {};
  let _options: StateOptions;
  let _disposed = false;

  const _view = (
    id: string,
    active: boolean,
    position: number,
    channelPosition: number,
    error?: string
  ): SubscriptionViewModel => {
    const view = (_views[id] = _views[id] || {
      id,
      active,
      position,
      channelStatus: "",
      channelPosition,
      endpointStatus: {
        name: "",
        code: 200,
        color: "success",
        icon: active ? "bi-activity" : "",
        status: "OK"
      },
      total: 0,
      events: []
    });

    view.active = active;
    view.position = Math.max(view.position, position);
    view.channelPosition = Math.max(view.channelPosition, channelPosition);
    if (error) {
      const messages = view.endpointStatus.error?.messages || [];
      messages.push(error);
      view.endpointStatus = {
        name: "",
        code: 500,
        color: "danger",
        icon: "bi-cone-striped",
        status: "Internal Server Error",
        error: { messages, position }
      };
    }
    return view;
  };

  const findSubscription = (id: string): ServiceWithWorker | undefined =>
    Object.values(_services).find(
      (producer) =>
        producer &&
        producer.config &&
        Object.values(producer.config.subscriptions).find(
          (sub) => sub.id === id
        )
    );

  const run = async (id: string, runs = 0): Promise<void> => {
    try {
      if (_timers[id]) {
        clearTimeout(_timers[id]);
        delete _timers[id];
      }
      if (_services[id] && _services[id].config)
        throw Error(
          `Service ${id} has active worker ${_services[id].config.workerId}`
        );

      const service = (_services[id] = (
        await subscriptions().loadServices(id)
      )[0] as ServiceWithWorker);
      if (!service) return;

      const pullUrl = new URL(encodeURI(service.channel));
      const pushUrl = new URL(encodeURI(service.url));
      const pull = _options.resolvers.pull[pullUrl.protocol];
      const push = _options.resolvers.push[pushUrl.protocol];
      if (!pull) throw Error(`Cannot resolve pull ${pullUrl.href}`);
      if (!push) throw Error(`Cannot resolve push ${pushUrl.href}`);
      const pullChannel = pull(pullUrl, service.id);
      const pushChannel = push(pushUrl, service.id, service.id);
      service.label = `${pullChannel.label}${pushChannel.label}`;

      const subs = await subscriptions().loadSubscriptionsByProducer(id);
      subs.forEach(({ id, active, position }) => {
        _view(id, active, position, service.position);
      });
      const active = subs.filter((sub) => sub.active);
      if (active.length) {
        const config: WorkerConfig = {
          id: service.id,
          workerId: -1,
          channel: service.channel,
          subscriptions: active.reduce((subs, sub) => {
            subs[sub.id] = sub;
            return subs;
          }, {} as Record<string, Subscription>),
          runs: Math.max(runs, 0)
        };
        const { id } = cluster.fork({ WORKER_ENV: JSON.stringify(config) });
        service.config = { ...config, workerId: id };
      }
    } catch (error) {
      log().error(error);
    }
  };

  const subscribeSSE = (
    session: string,
    stream: Writable,
    id?: string
  ): void => {
    if (_disposed) return;
    _sse[session] = { stream, id };
  };

  const unsubscribeSSE = (session: string): void => {
    if (_disposed) return;
    delete _sse[session];
  };

  const emitService = (service: Service): void => {
    const found = Object.values(_sse).filter(({ id }) => !id);
    if (found.length) {
      found.forEach(({ stream }) => {
        stream.write(`id: ${service.id}\n`);
        stream.write(`event: health\n`);
        stream.write(`data: ${JSON.stringify(service)}\n\n`);
      });
    }
  };

  const emitState = (
    state?: SubscriptionState,
    view?: SubscriptionViewModel
  ): void => {
    const subid = (state && state.id) || (view && view.id);
    const found = Object.values(_sse).filter(
      ({ id }) => subid === (id || subid)
    );
    if (found.length) {
      !view &&
        (view = _views[state.id] =
          toViewModel(
            state,
            _services[state.producer],
            _services[state.consumer]
          ));
      found.forEach(({ stream }) => {
        stream.write(`id: ${view.id}\n`);
        stream.write(`event: state\n`);
        stream.write(`data: ${JSON.stringify(view)}\n\n`);
      });
    }
  };

  const emitError = (
    { id, active, position }: Subscription,
    error: string
  ): void => {
    emitState(undefined, _view(id, active, position, -1, error));
  };

  const _state = (state: SubscriptionState): void => {
    const producer = _services[state.producer];
    if (producer) {
      producer.status = "";
      producer.position = Math.max(producer.position, state.position);
    }
    emitState(state);
  };

  const _error = (config: WorkerConfig, { message }: ErrorMessage): void => {
    Object.values(config.subscriptions).map((sub) => emitError(sub, message));
  };

  const onMessage = (
    workerId: number,
    { error, state, trigger }: WorkerMessage
  ): void => {
    if (state) _state(state);
    else {
      const producer = Object.values(_services).find(
        (service) => service && service.config?.workerId === workerId
      );
      if (!producer) return;
      error && _error(producer.config, error);
      trigger &&
        (producer.position = Math.max(
          producer.position,
          trigger.position || -1
        ));
    }
  };

  const onExit = (workerId: number, code: number, signal: string): void => {
    if (_disposed) return;

    const message = `Worker ${workerId} exited with ${
      signal ? signal : `code ${code}`
    }`;
    log().info("bgRed", `[${process.pid}]`, message);

    const producer = Object.values(_services).find(
      (service) => service && service.config?.workerId === workerId
    );
    if (!producer) return;

    _error(producer.config, { message });
    producer.status = message;
    const runs = producer.config.runs + 1;
    delete producer.config;

    // retry worker MAX_RUNS times after exits
    if (runs > MAX_RUNS) {
      log().error(Error(`Too many runs in session for worker ${producer.id}`));
      return;
    }
    const wait = runs * RUN_RETRY_TIMEOUT;
    log().trace("bgRed", `Retrying worker ${producer.id} in ${wait}ms`);
    _timers[producer.id] = setTimeout(() => run(producer.id, runs), wait);
  };

  cluster.on("message", (worker, message: WorkerMessage) =>
    onMessage(worker.id, message)
  );
  cluster.on("exit", (worker, code, signal) => onExit(worker.id, code, signal));

  const discover = async (service: Service): Promise<void> => {
    try {
      if (!service) return;
      if (
        !service.discovered ||
        Date.now() - service.discovered.getTime() > 30 * 1000
      ) {
        await refreshServiceSpec(service);
        emitService(service);
      }
    } catch (error) {
      log().error(error);
    }
  };

  // discovery runs every 30s
  const discoverServices = (): void => {
    Object.values(_services).forEach((s) => void discover(s));
  };
  const discoveryTimer = setInterval(discoverServices, 30 * 1000);

  const killWorker = async (worker: Worker): Promise<void> =>
    new Promise((resolve, reject) => {
      worker.process.once("exit", resolve);
      worker.process.once("error", reject);
      worker.process.kill();
    });

  const refreshService = async (
    id: string,
    operation: Operation
  ): Promise<boolean | undefined> => {
    if (_disposed) return;
    log().trace("bgWhite", JSON.stringify({ operation, id }));
    try {
      const config = _services[id]?.config;
      const worker = config && cluster.workers[config.workerId];
      if (operation === "DELETE") delete _services[id];
      if (worker) {
        // kill running worker, onExit will restart it at run=0
        // unless deleted
        config.runs = -1;
        await killWorker(worker);
      } else await run(id);
    } catch (error) {
      log().error(error);
    }
  };

  const refreshSubscription = async (
    id: string,
    operation: Operation
  ): Promise<boolean | undefined> => {
    if (_disposed) return;
    log().trace("bgWhite", JSON.stringify({ operation, id }));
    try {
      const [sub] = await subscriptions().loadSubscriptions(id);
      if (sub) {
        const existingService = findSubscription(id);
        const existingWorker =
          existingService &&
          existingService.config &&
          cluster.workers[existingService.config.workerId];
        if (existingWorker && existingService.id !== sub.producer) {
          // delete from existing worker when changing producer
          existingWorker.send({ operation: "DELETE", sub });
        }
        const config = _services[sub.producer]?.config;
        const worker = config && cluster.workers[config.workerId];
        if (worker) {
          config.runs = 0;
          if (sub.active) config.subscriptions[id] = sub;
          else delete config.subscriptions[id];
          worker.send({ operation, sub });
        } else await run(sub.producer); // when producer is not working
      }
    } catch (error) {
      log().error(error);
    }
  };

  dispose(async () => {
    _disposed = true;
    Object.entries(_timers).forEach(([id, timer]) => {
      clearTimeout(timer);
      delete _timers[id];
    });
    await operationsLoop.stop();
  });

  return {
    name: "state",
    dispose: () => {
      clearInterval(discoveryTimer);
      cluster.removeAllListeners();
      return Promise.resolve();
    },
    services: () =>
      Object.values(_services)
        .filter(Boolean)
        .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)),
    discoverServices,
    discover,
    init: async (services: Service[], options: StateOptions): Promise<void> => {
      _options = options;
      const cores = cpus().length;
      log().info(
        "green",
        `Cluster started with ${cores} cores`,
        JSON.stringify(_options)
      );
      await Promise.all(
        services.filter(Boolean).map((service) => {
          _services[service.id] = service;
          return run(service.id);
        })
      );
    },
    serviceLogLink: (id: string): string =>
      _options.serviceLogLinkTemplate &&
      encodeURI(_options.serviceLogLinkTemplate.replaceAll("<<SERVICE>>", id)),
    subscribeSSE,
    unsubscribeSSE,
    viewModel: (sub: Subscription): SubscriptionViewModel => {
      const service = _services[sub.producer];
      const config = service?.config;
      const worker = config && cluster.workers[config.workerId];
      worker && worker.send({ operation: "REFRESH", sub });
      return _view(
        sub.id,
        sub.active,
        sub.position,
        (service && service.position) || -1
      );
    },
    onMessage,
    onExit,
    refreshService: (operation: Operation, id: string) => {
      operationsLoop.push({ id, action: () => refreshService(id, operation) });
    },
    refreshSubscription: (operation: Operation, id: string) => {
      operationsLoop.push({
        id,
        action: () => refreshSubscription(id, operation)
      });
    },
    state: () =>
      Object.values(_services)
        .filter((service) => service && service.config)
        .map((service) => service.config)
  };
});
