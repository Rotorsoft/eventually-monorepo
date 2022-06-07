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
import {
  ChannelConfig,
  State,
  SubscriptionConfig,
  SubscriptionState,
  SubscriptionStats,
  SubscriptionViewModel,
  WorkerMessage
} from "./types";

export const state = singleton(function state(): State {
  const _services: Record<string, Service> = {};
  const _channels: Record<number, ChannelConfig> = {};
  const _states: Record<string, SubscriptionState> = {};
  const _sse: Record<string, { stream: Writable; id?: string }> = {};

  const findWorkerId = (producer: string): number | undefined => {
    const [workerId] = Object.entries(_channels)
      .filter(([, value]) => value.id === producer)
      .map(([id]) => parseInt(id));
    return workerId;
  };

  const resetState = (
    workerId?: number,
    active = false,
    position = -1
  ): SubscriptionState => {
    return {
      workerId,
      active,
      position,
      channelStatus: "",
      endpointStatus: {
        code: 200,
        color: "success"
      },
      errorMessage: "",
      errorPosition: -1,
      stats: {
        total: 0,
        batches: 0,
        events: {}
      }
    };
  };

  const subConfig = ({
    id,
    active,
    consumer,
    path,
    streams,
    names,
    position
  }: Subscription): SubscriptionConfig => ({
    id,
    active,
    endpoint: `${_services[consumer].url}/${path}`,
    streams,
    names,
    position
  });

  const run = async (id: string, runs = 0): Promise<void> => {
    if (++runs > 10) {
      log().error(Error(`Too many runs in session for channel ${id}`));
      return;
    }
    try {
      _services[id] = (await subscriptions().loadServices(id))[0];
      const subs = await subscriptions().loadSubscriptionsByProducer(id);
      const config: ChannelConfig = {
        id,
        channel: encodeURI(_services[id].channel),
        subscriptions: subs
          .map((sub) => subConfig(sub))
          .filter((p) => p.active),
        runs
      };
      let workerId: number = undefined;
      if (config.subscriptions.length) {
        const worker = cluster.fork({ WORKER_ENV: JSON.stringify(config) });
        workerId = worker.id;
        _channels[worker.id] = config;
      }
      subs.map(({ id, active, position }) => {
        _states[id] = resetState(workerId, active, position);
        emitSSE(id);
      });
    } catch (error) {
      log().error(error);
    }
  };

  const viewModel = (id: string): SubscriptionViewModel => {
    const {
      workerId,
      active,
      position,
      stats,
      channelStatus,
      endpointStatus,
      errorMessage,
      errorPosition
    } = _states[id] || resetState();
    const channel = _channels[workerId];
    const eventsMap: Record<string, EventsViewModel> = {};
    Object.entries(stats.events).map(([name, value]) => {
      const event = (eventsMap[name] = eventsMap[name] || {
        name,
        ok: value[200],
        ignored: value[204],
        retryable: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 },
        critical: { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 }
      });
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
    const events = Object.values(eventsMap);
    return {
      id,
      active,
      position,
      channelStatus,
      channelPosition: channel ? _services[channel.id].position : -1,
      endpointStatus: {
        ...endpointStatus,
        icon:
          errorMessage || channelStatus
            ? "bi-cone-striped"
            : active
            ? "bi-activity"
            : ""
      },
      errorMessage,
      errorPosition,
      total: stats.total,
      events: Object.values(events),
      lastEventName: stats.lastEventName
    };
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

  const emitSSE = (id: string): void => {
    const found = Object.values(_sse).filter(
      ({ id: subid }) => id === (subid || id)
    );
    if (found.length) {
      const props = viewModel(id);
      found.map(({ stream }) => {
        stream.write(`id: ${props.id}\n`);
        stream.write(`event: message\n`);
        stream.write(`data: ${JSON.stringify(props)}\n\n`);
      });
    }
  };

  const _stats = (
    workerId: number,
    channel: ChannelConfig,
    {
      id,
      active,
      position,
      total,
      batches,
      events,
      lastEventName
    }: SubscriptionConfig & SubscriptionStats
  ): void => {
    _services[channel.id].position = Math.max(
      _services[channel.id].position,
      position
    );
    const state = (_states[id] =
      _states[id] || resetState(workerId, true, position));
    state.active = active;
    state.position = Math.max(state.position, position);
    if (position > state.errorPosition) {
      state.errorMessage = "";
      state.endpointStatus = { code: 200, color: "success" };
    }

    const acc = state.stats;
    acc.batches += batches;
    acc.total += total;
    acc.lastEventName = lastEventName;
    Object.entries(events).map(([name, codes]) => {
      Object.entries(codes).map(([code, estats]) => {
        const event = (acc.events[name] = acc.events[name] || {});
        const stats = (event[parseInt(code)] = event[parseInt(code)] || {
          count: 0,
          min: Number.MAX_SAFE_INTEGER,
          max: -1
        });
        stats.count += estats.count;
        stats.min = Math.min(stats.min, estats.min);
        stats.max = Math.max(stats.max, estats.max);
      });
    });
    emitSSE(id);
  };

  const _error = (
    workerId: number,
    channel: ChannelConfig,
    id: string,
    { message, config, code = 500, color = "danger", stats }: ErrorMessage
  ): void => {
    config && stats && _stats(workerId, channel, { ...config, ...stats });
    _states[id].errorMessage = message;
    _states[id].position = Math.max(
      _states[id].position,
      config.position || -1
    );
    _states[id].endpointStatus = { code, color };
    emitSSE(id);
  };

  const onMessage = (
    workerId: number,
    { error, stats, trigger }: WorkerMessage
  ): void => {
    const channel = _channels[workerId];
    if (!channel) return;

    if (error) {
      error.config?.id
        ? _error(workerId, channel, error.config?.id, error)
        : channel.subscriptions.map(({ id }) =>
            _error(workerId, channel, id, error)
          );
    } else if (stats) _stats(workerId, channel, stats);
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
    log().info(
      "bgRed",
      `[${process.pid}]`,
      `exit ${channel.id} ${signal ? signal : `code ${code}`}`
    );
    channel.subscriptions.map(({ id }) => {
      _states[id].channelStatus = signal || `E${code}`;
      emitSSE(id);
    });
    // re-run when exit code == 0
    !code && void run(channel.id, channel.runs);
  };

  cluster.on("message", (worker, message: WorkerMessage) =>
    onMessage(worker.id, message)
  );
  cluster.on("exit", (worker, code, signal) => onExit(worker.id, code, signal));

  return {
    name: "state",
    dispose: () => {
      cluster.removeAllListeners();
      return Promise.resolve();
    },
    services: () =>
      Object.values(_services).sort((a, b) =>
        a.id > b.id ? 1 : a.id < b.id ? -1 : 0
      ),
    init: async (services: Service[]): Promise<void> => {
      const cores = cpus().length;
      log().info("green", `Cluster started with ${cores} cores`);
      await Promise.all(
        services.map((service) => {
          _services[service.id] = service;
          return run(service.id);
        })
      );
    },
    subscribeSSE,
    unsubscribeSSE,
    viewModel,
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
        const config: SubscriptionConfig = sub
          ? subConfig(sub)
          : {
              id,
              active: false,
              endpoint: "",
              streams: "",
              names: "",
              position: -1
            };

        const { workerId } = _states[id] || resetState();
        const worker = cluster.workers[workerId];
        worker && worker.send({ operation, config });

        if (operation !== "DELETE") {
          const newWorkerId = findWorkerId(sub.producer);
          const newWorker = cluster.workers[newWorkerId];

          (newWorkerId || -1) !== (workerId || -2)
            ? newWorker
              ? newWorker.send({ operation, config })
              : await run(sub.producer)
            : undefined;
        }
      } catch (error) {
        log().error(error);
      }
    }
  };
});
