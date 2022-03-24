import { log, singleton } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { Writable } from "stream";
import {
  Operation,
  Service,
  Subscription,
  subscriptions,
  TriggerPayload
} from ".";

// TODO: refactor
export type ChannelConfig = {
  id: string;
  channel: string;
  endpoint: string;
  streams: string;
  names: string;
  position: number;
  producer: string;
  consumer: string;
};

type EventStats = { count: number; min: number; max: number };

export type SubscriptionStats = {
  id: string;
  trigger: TriggerPayload;
  batches: number;
  total: number;
  events: Record<string, Record<number, EventStats>>;
};

type SubscriptionState = {
  active: boolean;
  channel: string;
  position: number;
  exitStatus: string;
  error: string;
  stats: SubscriptionStats;
};

export type SubscriptionViewModel = {
  id: string;
  active: boolean;
  exitStatus: string;
  error: string;
  color: string;
  icon: string;
  position: number;
  channelPosition: number;
  total: number;
  events: Array<{
    name: string;
    ok: EventStats;
    ignored: EventStats;
    errors: EventStats;
  }>;
};

const resetState = (
  id: string,
  channel: string,
  position: number
): SubscriptionState => ({
  active: false,
  channel,
  position,
  exitStatus: "",
  error: "",
  stats: {
    id,
    trigger: { id, operation: "RESTART" },
    total: 0,
    batches: 0,
    events: {}
  }
});

type State = {
  init: (services: Service[], subs: Subscription[]) => Promise<void>;
  refreshService: (operation: Operation, id: string) => Promise<void>;
  refreshSubscription: (operation: Operation, id: string) => Promise<void>;
  subscribeSSE: (session: string, stream: Writable, id?: string) => void;
  unsubscribeSSE: (session: string) => void;
  services: () => Service[];
  viewModel: (id: string) => SubscriptionViewModel;
};

export const state = singleton((): State => {
  const services: Record<string, Service> = {};
  const running: Record<number, ChannelConfig> = {};
  const status: Record<string, SubscriptionState> = {};
  const channels: Record<string, number> = {};
  const sse: Record<string, { stream: Writable; id?: string }> = {};

  const run = async (id: string): Promise<void> => {
    const [sub] = await subscriptions().loadSubscriptions(id);
    if (sub) {
      const { active, position, producer, consumer, path, streams, names } =
        sub;
      const ps = services[producer];
      const cs = services[consumer];
      const config: ChannelConfig = {
        id,
        channel: ps?.channel || "producer not found!",
        endpoint: cs ? `${cs.url}/${path}` : "consumer not found!",
        streams,
        names,
        position,
        producer,
        consumer
      };
      if (active && ps && cs) {
        status[id] = resetState(id, config.channel, position);
        status[id].active = true;
        const { id: workerId } = cluster.fork({
          WORKER_ENV: JSON.stringify(config)
        });
        running[workerId] = config;
      } else {
        status[id] = {
          ...resetState(id, config.channel, position),
          ...status[id],
          active: false
        };
      }
      emitSSE(id);
    }
  };

  const viewModel = (id: string): SubscriptionViewModel => {
    const { active, channel, position, stats, exitStatus, error } =
      status[id] || resetState(id, "", -1);
    return {
      id,
      active,
      exitStatus,
      error,
      color: active ? (error ? "danger" : "success") : "secondary",
      icon: active
        ? error || exitStatus
          ? "bi-cone-striped"
          : "bi-activity"
        : "",
      position,
      channelPosition: channels[channel] || -1,
      total: stats.total,
      events: Object.entries(stats.events).map(([key, value]) => ({
        name: key,
        ok: value[200],
        ignored: value[204],
        errors: Object.entries(value)
          .filter(([k]) => k !== "200" && k !== "204")
          .reduce<EventStats>(
            (p, [, v]) => ({
              count: p.count + v.count,
              min: Math.min(p.min, v.min),
              max: Math.max(p.max, v.max)
            }),
            { count: 0, min: Number.MAX_SAFE_INTEGER, max: -1 }
          )
      }))
    };
  };

  const subscribeSSE = (
    session: string,
    stream: Writable,
    id?: string
  ): void => {
    sse[session] = { stream, id };
  };

  const unsubscribeSSE = (session: string): void => {
    delete sse[session];
  };

  const emitSSE = (id: string): void => {
    const found = Object.values(sse).filter(
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

  const setChannelPosition = (channel: string, position: number): void => {
    channels[channel] = Math.max(channels[channel] || -1, position || -1);
  };

  const error = (workerId: number, error: string, position: number): void => {
    const runner = running[workerId];
    if (runner) {
      status[runner.id].error = error;
      status[runner.id].position = position;
      emitSSE(runner.id);
    }
  };

  const stats = (
    workerId: number,
    stats: SubscriptionStats,
    position: number
  ): void => {
    const runner = running[workerId];
    if (runner) {
      setChannelPosition(runner.channel, position);
      status[runner.id].position = position;
      const acc = status[runner.id].stats;
      acc.trigger = stats.trigger;
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
      emitSSE(runner.id);
    }
  };

  cluster.on(
    "message",
    (
      worker,
      msg: {
        position: number;
        channel?: string;
        error?: string;
        stats?: SubscriptionStats;
      }
    ) => {
      msg.channel && setChannelPosition(msg.channel, msg.position);
      msg.error && error(worker.id, msg.error, msg.position);
      msg.stats && stats(worker.id, msg.stats, msg.position);
    }
  );

  cluster.on("exit", (worker, code, signal) => {
    const runner = running[worker.id];
    if (runner) {
      log().info(
        "red",
        `exit ${runner.id} with ${signal ? signal : `code ${code}`}`
      );
      delete running[worker.id];
      status[runner.id].exitStatus = signal || `E${code}`;
      // reload worker when active and interrupted by recoverable runtime errors
      if (code < 100 || signal === "SIGINT") void run(runner.id);
      emitSSE(runner.id);
    }
  });

  return {
    services: () =>
      Object.values(services).sort((a, b) =>
        a.id > b.id ? 1 : a.id < b.id ? -1 : 0
      ),
    init: async (servs: Service[], subs: Subscription[]): Promise<void> => {
      const cores = cpus().length;
      log().info("green", `Cluster started with ${cores} cores`);
      servs.map((service) => (services[service.id] = service));
      await Promise.all(subs.map((sub) => run(sub.id)));
    },
    subscribeSSE,
    unsubscribeSSE,
    viewModel,
    refreshService: async (operation: Operation, id: string) => {
      log().info("white", operation, id);
      const [service] = await subscriptions().loadServices(id);
      if (service) {
        switch (operation) {
          case "INSERT":
            services[service.id] = service;
            break;
          case "UPDATE":
            Object.entries(running)
              .filter(
                ([, value]) => value.producer === id || value.consumer === id
              )
              .map(([id]) => cluster.workers[id].kill("SIGINT"));
            break;
          case "DELETE":
            delete services[service.id];
            break;
        }
      }
    },
    refreshSubscription: async (operation: Operation, id: string) => {
      log().info("white", operation, id);
      const [workerId] = Object.entries(running)
        .filter(([, value]) => value.id === id)
        .map(([id]) => parseInt(id));
      if (workerId) cluster.workers[workerId].kill("SIGINT");
      else if (operation !== "DELETE") await run(id);
    }
  };
});
