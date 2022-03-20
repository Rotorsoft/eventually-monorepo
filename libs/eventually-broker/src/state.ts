import { singleton } from "@rotorsoft/eventually";
import { Writable } from "stream";
import { Props, Subscription, SubscriptionStats } from ".";
import { Argument, mapProps } from "./utils";

export type WorkerStatus = {
  exitStatus: string;
  error: string;
  stats: SubscriptionStats;
  maxTriggerPosition: number;
};

const _emit = (stream: Writable, props: Props): void => {
  stream.write(`id: ${props.id}\n`);
  stream.write(`event: message\n`);
  stream.write(`data: ${JSON.stringify(props)}\n\n`);
};

export type BrokerState = {
  findWorkerId: (id: string) => number | undefined;
  get: (id: string) => WorkerStatus | undefined;
  reset: (workerId: number, arg: Argument) => void;
  error: (workerId: number, error: string) => void;
  stats: (workerId: number, stats: any) => void;
  exit: (
    workerId: number,
    code?: number,
    signal?: string
  ) => Argument | undefined;
  allStream: (stream: Writable) => void;
  stream: (id: string, stream: Writable) => void;
};

export const state = singleton((): BrokerState => {
  const running: Record<number, Argument> = {};
  const status: Record<string, WorkerStatus> = {};
  const triggers: Record<string, number> = {};
  const streams: Record<string, Writable> = {};
  let allStream: Writable;

  const findWorkerId = (id: string): number => {
    const [workerId] = Object.entries(running)
      .filter(([, value]) => value.id === id)
      .map(([id]) => parseInt(id));
    return workerId;
  };

  const emit = (runner: Subscription): void => {
    const stream = streams[runner.id];
    if (allStream || stream) {
      const props = mapProps(runner, status[runner.id]);
      allStream && _emit(allStream, props);
      stream && _emit(stream, props);
    }
  };

  return {
    findWorkerId,
    get: (id: string) => status[id],
    reset: (workerId: number, arg: Argument) => {
      running[workerId] = arg;
      status[arg.id] = {
        exitStatus: "",
        error: "",
        stats: {
          id: arg.id,
          trigger: { id: "", operation: "RESTART" },
          total: 0,
          batches: 0,
          position: -1,
          events: {}
        },
        maxTriggerPosition: -1
      };
    },
    error: (workerId: number, error: string) => {
      const runner = running[workerId] as Subscription;
      runner && (status[runner.id].error = error);
      emit(runner);
    },
    stats: (workerId: number, stats: any) => {
      const runner = running[workerId] as Subscription;
      if (runner) {
        const cur = stats as SubscriptionStats;
        status[runner.id].maxTriggerPosition = triggers[runner.channel] =
          Math.max(triggers[runner.channel] || -1, cur.trigger.position || -1);
        const acc = status[runner.id].stats;
        acc.trigger = cur.trigger;
        acc.position = cur.position;
        acc.batches += cur.batches;
        acc.total += cur.total;
        Object.entries(cur.events).map(([name, codes]) => {
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
        emit(runner);
      }
    },
    exit: (workerId: number, code?: number, signal?: string) => {
      const runner = running[workerId] as Subscription;
      if (runner) {
        delete running[workerId];
        status[runner.id].exitStatus = signal || `E${code}`;
        emit(runner);
      }
      return runner;
    },
    allStream: (stream: Writable) => {
      allStream = stream;
    },
    stream: (id: string, stream: Writable) => {
      streams[id] = stream;
    }
  };
});
