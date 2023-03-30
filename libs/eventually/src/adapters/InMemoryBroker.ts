import { randomUUID } from "crypto";
import { event, project } from "../handlers";
import { Broker, SnapshotStore } from "../interfaces";
import { app, log, store } from "../ports";
import { scheduler } from "../scheduler";
import {
  ArtifactMetadata,
  ArtifactType,
  CommittedEvent,
  EventHandlerFactory,
  Messages,
  PolicyFactory,
  ProcessManagerFactory,
  ProjectorFactory,
  Scope
} from "../types";
import { sleep } from "../utils";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];

const _poll = async <E extends Messages>(
  consumer: ArtifactMetadata,
  timeout: number,
  limit: number
): Promise<void> => {
  const lease = randomUUID();
  let count = limit;
  let stop = false;
  let lastId = -1;
  // drain the stream
  while (count === limit && !stop) {
    try {
      const events: Array<CommittedEvent<E>> = [];
      await store().poll<E>(
        consumer.factory.name,
        consumer.inputs.map((input) => input.name),
        limit,
        lease,
        timeout,
        (e) => events.push(e)
      );
      count = events.length;
      for (const e of events) {
        if (consumer.type === "projector")
          await project(consumer.factory as ProjectorFactory, e);
        else if (consumer.type === "policy")
          await event(consumer.factory as PolicyFactory, e);
        else {
          // process managers skip their own events
          if (e.stream !== (consumer.factory as ProcessManagerFactory)().stream)
            await event(consumer.factory as EventHandlerFactory, e);
        }
        lastId = e.id;
      }
    } catch (error) {
      log().error(error);
      stop = true;
    } finally {
      await store().ack(consumer.factory.name, lease, lastId);
      //console.log("ack", consumer.factory.name, { count, lastId });
    }
  }
};

/**
 * @category Adapters
 * @remarks In-memory broker connects private event handlers with events being produced in service
 * @param timeout lease expiration time (in ms) when polling the store
 * @param limit max number of events to poll in each try
 * @param throttle delay (in ms) to enqueue new polls
 */
export const InMemoryBroker = (
  timeout = 1000,
  limit = 10,
  throttle = 500
): Broker => {
  const name = "InMemoryBroker";
  const schedule = scheduler(name);

  // connect private event handlers only, public ones are connected by a broker service
  const consumers = [...app().artifacts.values()].filter(
    (v) =>
      event_handler_types.includes(v.type) &&
      v.inputs.length &&
      v.inputs.at(0)?.scope === Scope.private
  );

  const _pollAll = async (): Promise<boolean> => {
    for (let i = 0; i < consumers.length; i++) {
      await _poll(consumers[i], timeout, limit);
    }
    return true;
  };

  const poll = (delay?: number): void => {
    schedule.push({
      id: "poll",
      action: _pollAll,
      delay
    });
  };

  // subscribe broker to commit events
  app().on("commit", async ({ factory, snapshot }) => {
    // console.log(
    //   "commit",
    //   factory.name,
    //   snapshot?.event?.name,
    //   snapshot?.event?.data,
    //   snapshot?.state
    // );
    if (snapshot && snapshot.event) {
      const snapStore = app().stores.get(factory.name) as SnapshotStore;
      if (snapStore && snapshot.applyCount >= snapStore.threshold)
        await snapStore
          .upsert(snapshot.event.stream, snapshot)
          .catch((error) => log().error(error));
    }
    poll(throttle);
  });

  return {
    name,
    dispose: () => Promise.resolve(),
    poll,
    drain: async () => {
      poll();
      await sleep(100);
      await schedule.stop();
    }
  };
};
