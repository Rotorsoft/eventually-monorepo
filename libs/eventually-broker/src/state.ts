import { singleton } from "@rotorsoft/eventually";
import { Writable } from "stream";
import { Props, Subscription, SubscriptionStats } from ".";
import { Argument, mapProps } from "./utils";

export type WorkerStatus = {
  status: string;
  error: string;
  stats: SubscriptionStats;
  maxTriggerPosition: number;
};

const send = (stream: Writable, props: Props): void => {
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
  const streams: Record<string, Writable> = {};
  let allStream: Writable;

  return {
    findWorkerId: (id: string) => {
      const [workerId] = Object.entries(running)
        .filter(([, value]) => value.id === id)
        .map(([id]) => parseInt(id));
      return workerId;
    },
    get: (id: string) => status[id],
    reset: (workerId: number, arg: Argument) => {
      running[workerId] = arg;
      status[arg.id] = {
        status: "",
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
      const runner = running[workerId];
      runner && (status[runner.id].error = error);
    },
    stats: (workerId: number, stats: any) => {
      const runner = running[workerId] as Subscription;
      if (runner) {
        const _status = status[runner.id];
        const acc = _status.stats;
        const cur = stats as SubscriptionStats;
        acc.trigger = cur.trigger;
        acc.position = cur.position;
        acc.batches += cur.batches;
        acc.total += cur.total;
        Object.entries(cur.events).map(([name, codes]) => {
          Object.entries(codes).map(([code, count]) => {
            acc.events[name] = acc.events[name] || {};
            acc.events[name][parseInt(code)] =
              (acc.events[name][parseInt(code)] || 0) + count;
          }, 0);
        }, 0);
        _status.maxTriggerPosition = Math.max(
          _status.maxTriggerPosition,
          cur.trigger.position || -1
        );
        const stream = streams[runner.id];
        if (allStream || stream) {
          const props = mapProps(runner, _status);
          allStream && send(allStream, props);
          stream && send(stream, props);
        }
      }
    },
    exit: (workerId: number, code?: number, signal?: string) => {
      const runner = running[workerId];
      if (runner) {
        delete running[workerId];
        status[runner.id].status = signal || `Exit ${code}`;
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
