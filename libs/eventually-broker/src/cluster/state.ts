import { log, singleton } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { Writable } from "stream";
import { CommittableHttpStatus, EventsViewModel, RetryableHttpStatus } from ".";
import {
  Operation,
  Service,
  Subscription,
  subscriptions,
  TriggerPayload
} from "..";
import {
  ChannelConfig,
  State,
  SubscriptionConfig,
  SubscriptionState,
  SubscriptionStats,
  SubscriptionViewModel
} from "./types";

export const state = singleton((): State => {
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
  ): SubscriptionState => ({
    workerId,
    active,
    position,
    exitStatus: "",
    error: "",
    stats: {
      total: 0,
      batches: 0,
      events: {}
    }
  });

  const subConfig = ({
    id,
    active,
    consumer,
    path,
    streams,
    names,
    position
  }: Subscription): SubscriptionConfig | undefined => ({
    id,
    active,
    endpoint: `${_services[consumer].url}/${path}`,
    streams,
    names,
    position
  });

  const run = async (id: string, position: number): Promise<void> => {
    try {
      const { channel } =
        _services[id] || (await subscriptions().loadServices(id))[0];
      const subs = await subscriptions().loadSubscriptionsByProducer(id);
      const config: ChannelConfig = {
        id,
        channel,
        position,
        subscriptions: subs.map((sub) => subConfig(sub)).filter((p) => p.active)
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
    const { workerId, active, position, stats, exitStatus, error } =
      _states[id] || resetState();
    const channelPosition = workerId ? _channels[workerId]?.position : -1;
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
    const color = active
      ? events[0].critical?.count
        ? "danger"
        : events[0].retryable?.count
        ? "warning"
        : "success"
      : "secondary";
    return {
      id,
      active,
      exitStatus,
      error,
      color,
      icon:
        error || exitStatus ? "bi-cone-striped" : active ? "bi-activity" : "",
      position,
      channelPosition,
      total: stats.total,
      events: Object.values(events)
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

  const _error = (id: string, message: string, position?: number): void => {
    _states[id].error = message;
    _states[id].position = Math.max(_states[id].position, position || -1);
    emitSSE(id);
  };

  cluster.on(
    "message",
    (
      worker,
      {
        error,
        stats,
        trigger
      }: {
        error?: { message: string; id?: string; position?: number };
        stats?: SubscriptionStats & SubscriptionConfig;
        trigger?: TriggerPayload;
      }
    ) => {
      const channel = _channels[worker.id];
      if (!channel) return;

      if (error) {
        error.id
          ? _error(error.id, error.message, error.position)
          : channel.subscriptions.map(({ id }) => _error(id, error.message));
      } else if (stats) {
        channel.position = Math.max(channel.position, stats.position);
        const state = (_states[stats.id] =
          _states[stats.id] || resetState(worker.id, true, stats.position));
        state.active = stats.active;
        state.position = Math.max(state.position, stats.position);
        const acc = state.stats;
        acc.batches += stats.batches;
        acc.total += stats.total;
        Object.entries(stats.events).map(([name, codes]) => {
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
        emitSSE(stats.id);
      } else if (trigger) {
        channel.position = Math.max(channel.position, trigger.position || -1);
      }
    }
  );

  cluster.on("exit", (worker, code, signal) => {
    const channel = _channels[worker.id];
    if (!channel) return;
    delete _channels[worker.id];
    log().info(
      "red",
      `exit ${channel.id} with ${signal ? signal : `code ${code}`}`
    );
    channel.subscriptions.map(({ id }) => {
      _states[id].exitStatus = signal || `E${code}`;
      emitSSE(id);
    });
    // reload worker when active and interrupted by recoverable runtime errors
    (code || signal === "SIGINT") && void run(channel.id, channel.position);
  });

  return {
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
          return run(service.id, -1);
        })
      );
    },
    subscribeSSE,
    unsubscribeSSE,
    viewModel,
    refreshService: async (operation: Operation, id: string) => {
      try {
        const workerId = findWorkerId(id);
        if (workerId) cluster.workers[workerId].kill("SIGINT");
        else if (operation !== "DELETE") await run(id, -1);
      } catch (error) {
        log().error(error);
      }
    },
    refreshSubscription: async (operation: Operation, id: string) => {
      try {
        const [sub] = await subscriptions().loadSubscriptions(id);
        const config = subConfig(sub);

        const { workerId } = _states[id] || resetState();
        const worker = cluster.workers[workerId];
        worker && worker.send({ operation, config });

        const newWorkerId = findWorkerId(sub.producer);
        const newWorker = cluster.workers[newWorkerId];

        (newWorkerId || -1) !== (workerId || -2)
          ? newWorker
            ? newWorker.send({ operation, config })
            : await run(sub.producer, -1)
          : undefined;
      } catch (error) {
        log().error(error);
      }
    }
  };
});
