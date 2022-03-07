import {
  app,
  CommittedEvent,
  fork,
  log,
  Payload,
  Store,
  store,
  Subscription,
  subscriptions,
  TriggerCallback
} from "@rotorsoft/eventually";
import axios from "axios";
import { ExpressApp } from "./ExpressApp";

const BATCH_SIZE = 100;

type Response = {
  status: number;
  statusText: string;
};

type Stats = {
  after: number;
  batches: number;
  total: number;
  events: Record<string, Record<number, number>>;
};

const post = async (
  event: CommittedEvent<string, Payload>,
  endpoint: string
): Promise<Response> => {
  try {
    const { status, statusText } = await axios.post(endpoint, event);
    return { status, statusText };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const { status, statusText } = error.response;
        return { status, statusText };
      }
      log().error(error);
      return { status: 503, statusText: error.code };
    } else {
      log().error(error);
      // TODO: check network errors to return 503 or 500
      return { status: 503, statusText: error.message };
    }
  }
};

export const broker = (): {
  master: () => Promise<void>;
  worker: (factory: (table: string) => Store) => Promise<void>;
} => {
  // worker global variables
  let streams: RegExp,
    names: RegExp,
    pumping = false;

  const pump: TriggerCallback = async (trigger, sub): Promise<void> => {
    if (pumping) return;
    pumping = true;

    try {
      let count = BATCH_SIZE;
      const stats: Stats = {
        after: sub.position,
        batches: 0,
        total: 0,
        events: {}
      };
      while (count === BATCH_SIZE) {
        stats.batches++;
        const events: CommittedEvent<string, Payload>[] = [];
        count = await store().query((e) => events.push(e), {
          after: sub.position,
          limit: BATCH_SIZE
        });
        for (const e of events) {
          const response =
            streams.test(e.stream) && names.test(e.name)
              ? await post(e, sub.endpoint)
              : { status: 204, statusText: "Not Matched" };
          const { status } = response;

          stats.total++;
          const event = (stats.events[e.name] = stats.events[e.name] || {});
          event[status] = (event[status] || 0) + 1;

          if ([429, 503, 504].includes(status)) {
            // 429 - Too Many Requests
            // 503 - Service Unavailable
            // 504 - Gateway Timeout
            const retries = (trigger.retries || 0) + 1;
            if (retries <= 3)
              setTimeout(
                () =>
                  pump(
                    {
                      operation: "RETRY",
                      id: sub.position.toString(),
                      retries
                    },
                    sub
                  ),
                5000 * retries
              );
            break;
          } else if (status === 409) {
            // concurrency error - ignore by default
            // TODO: make this configurable by subscription?
          } else if (![200, 204].includes(status)) break; // break on errors

          // update position
          await subscriptions().commit(sub.id, e.id);
          sub.position = e.id;
        }
      }
      log().info(
        "blue",
        `[${process.pid}] pump ${sub.id} ${trigger.operation}@${trigger.id}`,
        `after=${stats.after} total=${stats.total} batches=${stats.batches}`,
        stats.events
      );
    } finally {
      pumping = false;
    }
  };

  return {
    master: async (): Promise<void> => {
      await subscriptions().init();
      const args = await subscriptions().load();
      const refresh = fork(args);
      const sub: Subscription = {
        id: "broker",
        channel: "subscriptions",
        streams: "",
        names: "",
        endpoint: "",
        active: true
      };
      void subscriptions().listen(sub, async (trigger) => {
        const [arg] = await subscriptions().load(trigger.id);
        refresh(trigger.operation, arg);
      });
      const express = app(new ExpressApp()).build();
      express.get("/subscriptions", async (_, res) => {
        const subs = await subscriptions().load();
        res.json(subs);
      });
      void app().listen();
    },

    worker: async (factory: (table: string) => Store): Promise<void> => {
      const sub: Subscription = JSON.parse(
        process.env.WORKER_ENV
      ) as Subscription;
      streams = RegExp(sub.streams);
      names = RegExp(sub.names);
      await store(factory(sub.channel)).init();
      void subscriptions().listen(sub, pump);
    }
  };
};
