import { log, singleton } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { Writable } from "stream";
import {
  CommittableHttpStatus,
  ErrorMessage,
  EventsViewModel,
  RetryableHttpStatus
} from ".";
import { Operation, Service, Subscription, subscriptions } from "..";
import { getServiceEndpoints } from "../utils";
import { State, StateOptions } from "./interfaces";
import {
  ChannelConfig,
  SubscriptionState,
  SubscriptionViewModel,
  SubscriptionWithEndpoint,
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
    (consumer.eventHandlers &&
      consumer.eventHandlers["/".concat(path)]?.events) ||
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
  return {
    channelStatus: producer.status || "",
    channelPosition: producer.position,
    id,
    active,
    position,
    endpointStatus,
    total: stats?.total,
    events: Object.values(eventsMap)
  };
};

const _emptyView = (
  id: string,
  active = false,
  position = -1
): SubscriptionViewModel => ({
  id,
  active,
  position,
  channelStatus: "",
  channelPosition: -1,
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

const MAX_CHANNEL_RUNS = 10;
const CHANNEL_RUN_RETRY_TIMEOUT = 10000;

export const state = singleton(function state(): State {
  const _services: Record<string, Service> = {};
  const _channels: Record<number, ChannelConfig> = {};
  const _sse: Record<string, { stream: Writable; id?: string }> = {};
  const _views: Record<string, SubscriptionViewModel> = {};
  let _options: StateOptions;

  const findWorkerId = (producer: string): number | undefined => {
    const [workerId] = Object.entries(_channels)
      .filter(([, value]) => value.id === producer)
      .map(([id]) => parseInt(id));
    return workerId;
  };

  const addEndpoint = (sub: Subscription): SubscriptionWithEndpoint => ({
    ...sub,
    endpoint: `${_services[sub.consumer].url}/${sub.path}`
  });

  const discover = async (service: Service): Promise<void> => {
    service.discovered = false;
    service.eventHandlers = {};
    service.commandHandlers = {};
    service.schemas = {};
    const endpoints = await getServiceEndpoints(service);
    if (endpoints) {
      service.discovered = true;
      endpoints.eventHandlers &&
        Object.entries(endpoints.eventHandlers).forEach(([name, value]) => {
          service.eventHandlers[value.path] = {
            name,
            path: value.path,
            type: value.type,
            events: value.events
          };
        });

      endpoints.commandHandlers &&
        Object.entries(endpoints.commandHandlers).forEach(([type, value]) => {
          Object.entries(value.commands).forEach(([name, path]) => {
            service.commandHandlers[path] = {
              name,
              path,
              type: `${value.type} ${type}`,
              events: value.events
            };
          });
        });

      endpoints.schemas &&
        Object.entries(endpoints.schemas).forEach(([name, value]) => {
          service.schemas[name] = value;
        });
    }
  };

  const run = async (id: string, runs = 0): Promise<void> => {
    try {
      const service = (_services[id] = (
        await subscriptions().loadServices(id)
      )[0]);
      const pullUrl = new URL(encodeURI(service.channel));
      const pushUrl = new URL(encodeURI(service.url));
      const pull = _options.resolvers.pull[pullUrl.protocol];
      const push = _options.resolvers.push[pushUrl.protocol];
      if (!pull) throw Error(`Cannot resolve pull ${pullUrl.href}`);
      if (!push) throw Error(`Cannot resolve push ${pushUrl.href}`);
      const pullChannel = pull(pullUrl, service.id);
      const pushChannel = push(pushUrl, service.id);
      service.label = `${pullChannel.label}${pushChannel.label}`;

      const subs = await subscriptions().loadSubscriptionsByProducer(id);
      const config: ChannelConfig = {
        id,
        channel: _services[id].channel,
        subscriptions: subs.reduce((obj, s) => {
          obj[s.id] = addEndpoint(s);
          return obj;
        }, {} as Record<string, SubscriptionWithEndpoint>),
        runs
      };
      subs.forEach(({ id, active, position }) => {
        _views[id] = _emptyView(id, active, position);
      });
      if (Object.values(config.subscriptions).length) {
        const worker = cluster.fork({
          WORKER_ENV: JSON.stringify(config)
        });
        _channels[worker.id] = config;
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
    _sse[session] = { stream, id };
  };

  const unsubscribeSSE = (session: string): void => {
    delete _sse[session];
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
        stream.write(`event: message\n`);
        stream.write(`data: ${JSON.stringify(view)}\n\n`);
      });
    }
  };

  const emitError = (
    { id, active, position }: Subscription,
    message: string
  ): void => {
    const view = _views[id];
    view.active = active;
    view.position = Math.max(view.position, position);
    view.endpointStatus = {
      name: undefined,
      code: 500,
      color: "danger",
      icon: "bi-cone-striped",
      status: "Internal Server Error",
      error: view.endpointStatus.error || {
        message,
        position: view.position
      }
    };
    view.endpointStatus.error.position < 0 &&
      (view.endpointStatus.error.position = view.position);
    emitState(undefined, view);
  };

  const _state = (state: SubscriptionState): void => {
    _services[state.producer].status = "";
    _services[state.producer].position = Math.max(
      _services[state.producer].position,
      state.position
    );
    emitState(state);
  };

  const _error = (channel: ChannelConfig, { message }: ErrorMessage): void => {
    Object.values(channel.subscriptions).map((sub) => emitError(sub, message));
  };

  const onMessage = (
    workerId: number,
    { error, state, trigger }: WorkerMessage
  ): void => {
    const channel = _channels[workerId];
    if (!channel) return;
    if (error) _error(channel, error);
    else if (state) _state(state);
    else if (trigger)
      _services[channel.id].position = Math.max(
        _services[channel.id].position,
        trigger.position || -1
      );
  };

  const onExit = (workerId: number, code: number, signal: string): void => {
    const channel = _channels[workerId];
    if (!channel) return;
    delete _channels[workerId];
    const message = `Channel ${channel.id} exited with ${
      signal ? signal : `code ${code}`
    }`;
    log().info("bgRed", `[${process.pid}]`, message);
    _services[channel.id].status = message;
    _error(channel, { message });

    if (!code) {
      // re-run when exit code == 0
      const runs = channel.runs + 1;
      if (runs > MAX_CHANNEL_RUNS) {
        log().error(
          Error(`Too many runs in session for channel ${channel.id}`)
        );
        return;
      }
      setTimeout(() => run(channel.id, runs), runs * CHANNEL_RUN_RETRY_TIMEOUT);
    }
  };

  cluster.on("message", (worker, message: WorkerMessage) =>
    onMessage(worker.id, message)
  );
  cluster.on("exit", (worker, code, signal) => onExit(worker.id, code, signal));

  // discovery loop every 30s
  const discoverServices = (): void => {
    Object.values(_services).forEach((s) => void discover(s));
  };
  const discoveryTimer = setInterval(discoverServices, 30 * 1000);

  return {
    name: "state",
    dispose: () => {
      clearInterval(discoveryTimer);
      cluster.removeAllListeners();
      return Promise.resolve();
    },
    services: () =>
      Object.values(_services).sort((a, b) =>
        a.id > b.id ? 1 : a.id < b.id ? -1 : 0
      ),
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
        services.map((service) => {
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
      const workerId = findWorkerId(sub.producer);
      const worker = cluster.workers[workerId];
      worker && worker.send({ operation: "REFRESH", sub: addEndpoint(sub) });
      return _views[sub.id] || _emptyView(sub.id);
    },
    onMessage,
    onExit,
    refreshService: async (operation: Operation, id: string) => {
      try {
        const workerId = findWorkerId(id);
        workerId && cluster.workers[workerId].kill("SIGINT");
        if (operation !== "DELETE") await run(id);
        else delete _services[id];
      } catch (error) {
        log().error(error);
      }
    },
    refreshSubscription: async (operation: Operation, id: string) => {
      try {
        const [sub] = await subscriptions().loadSubscriptions(id);
        if (sub) {
          const workerId = findWorkerId(sub.producer);
          if (workerId) {
            const channel = _channels[workerId];
            channel.subscriptions[id] = addEndpoint(sub);
            const worker = cluster.workers[workerId];
            worker &&
              worker.send({ operation, sub: channel.subscriptions[id] });

            if (operation !== "DELETE") {
              const newWorkerId = findWorkerId(sub.producer);
              const newWorker = cluster.workers[newWorkerId];

              (newWorkerId || -1) !== (workerId || -2)
                ? newWorker
                  ? newWorker.send({
                      operation,
                      sub: channel.subscriptions[id]
                    })
                  : await run(sub.producer)
                : undefined;
            }
          } else await run(sub.producer);
        }
      } catch (error) {
        log().error(error);
      }
    }
  };
});
