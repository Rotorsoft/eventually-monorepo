import { singleton } from "@rotorsoft/eventually";
import { Writable } from "stream";
import { Props, Subscription, SubscriptionStats } from ".";
import { mapProps } from "./utils";

export type WorkerStatus = {
  exitStatus: string;
  error: string;
  stats: SubscriptionStats;
};

const _emit = (stream: Writable, props: Props): void => {
  stream.write(`id: ${props.id}\n`);
  stream.write(`event: message\n`);
  stream.write(`data: ${JSON.stringify(props)}\n\n`);
};

export type BrokerState = {
  findWorkerId: (id: string) => number | undefined;
  setChannelPosition: (channel: string, position: number) => void;
  getChannelPosition: (channel: string) => number;
  getWorkerStatus: (id: string) => WorkerStatus | undefined;
  reset: (workerId: number, sub: Subscription) => void;
  error: (workerId: number, error: string) => void;
  stats: (workerId: number, stats: SubscriptionStats) => void;
  exit: (
    workerId: number,
    code?: number,
    signal?: string
  ) => Subscription | undefined;
  allStream: (stream: Writable) => void;
  stream: (id: string, stream: Writable) => void;
};

export const state = singleton((): BrokerState => {
  const running: Record<number, Subscription> = {};
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

  const setChannelPosition = (channel: string, position: number): void => {
    triggers[channel] = Math.max(triggers[channel] || -1, position || -1);
  };

  return {
    findWorkerId,
    setChannelPosition,
    getChannelPosition: (channel: string) => triggers[channel] || -1,
    getWorkerStatus: (id: string) => status[id],
    reset: (workerId: number, sub: Subscription) => {
      running[workerId] = sub;
      status[sub.id] = {
        exitStatus: "",
        error: "",
        stats: {
          id: sub.id,
          trigger: { id: "", operation: "RESTART" },
          total: 0,
          batches: 0,
          position: -1,
          events: {}
        }
      };
    },
    error: (workerId: number, error: string) => {
      const runner = running[workerId];
      runner && (status[runner.id].error = error);
      emit(runner);
    },
    stats: (workerId: number, stats: SubscriptionStats) => {
      const runner = running[workerId];
      if (runner) {
        setChannelPosition(runner.channel, stats.position);
        const acc = status[runner.id].stats;
        acc.trigger = stats.trigger;
        acc.position = stats.position;
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
        emit(runner);
      }
    },
    exit: (workerId: number, code?: number, signal?: string) => {
      const runner = running[workerId];
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
