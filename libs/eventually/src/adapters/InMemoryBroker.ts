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
  ProjectorFactory,
  Snapshot
} from "../types";
import { randomId } from "../utils";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];
const consumers = (): ArtifactMetadata[] =>
  Object.entries(app().artifacts)
    .filter(([, v]) => event_handler_types.includes(v.type) && v.inputs.length)
    .map(([k]) => app().artifacts[k]);

/**
 * @returns true to keep polling
 */
let _polling = false;
const poll = async <E extends Messages>(
  timeout: number,
  limit: number
): Promise<boolean> => {
  if (_polling) return false;
  _polling = true;
  let maxBatch = 0;
  for (const consumer of consumers()) {
    let watermark = -1;
    const lease = randomId();
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
      maxBatch = Math.max(maxBatch, events.length);
      for (const e of events) {
        if (consumer.type === "projector")
          await project(consumer.factory as ProjectorFactory, e);
        else if (consumer.type === "policy")
          await event(consumer.factory as PolicyFactory, e);
        else if (!e.stream.startsWith(consumer.factory.name))
          // process managers skip their own events
          await event(consumer.factory as EventHandlerFactory, e);
        watermark = e.id;
      }
    } catch (error) {
      log().error(error);
    }
    watermark > -1 &&
      (await store().ack(consumer.factory.name, lease, watermark));
  }
  _polling = false;
  return maxBatch === limit;
};

const snapshot = async (
  store: SnapshotStore,
  stream: string,
  snapshot: Snapshot
): Promise<boolean> => {
  await store.upsert(stream, snapshot).catch((error) => log().error(error));
  return true;
};

/**
 * @category Adapters
 * @remarks In-memory synchronous broker
 * - only used when testing
 */
export const InMemorySyncBroker = (timeout = 100, limit = 5): Broker => ({
  name: "InMemorySyncBroker",
  dispose: () => Promise.resolve(),
  poll: () => poll(timeout, limit),
  snapshot
});

/**
 * @category Adapters
 * @remarks In-memory asynchronous broker
 */
export const InMemoryAsyncBroker = (
  pollingFrequency = 60 * 1000,
  timeout = 5000,
  limit = 25
): Broker => {
  const name = "InMemoryAsyncBroker";
  const schedule = scheduler(name);

  const _poll = async (): Promise<boolean> => {
    try {
      log().magenta().trace("async broker polling...");
      const more = await poll(timeout, limit);
      schedule.push({
        id: "poll",
        action: _poll,
        delay: more ? 100 : pollingFrequency
      });
      return true;
    } catch (error) {
      log().error(error);
      return false;
    }
  };

  return {
    name,
    dispose: () => schedule.dispose(),
    poll: () => {
      consumers().length && schedule.push({ id: "poll", action: _poll });
      return Promise.resolve(false);
    },
    snapshot: (store, stream, snap) => {
      schedule.push({
        id: "snapshot",
        action: async () => await snapshot(store, stream, snap)
      });
      return Promise.resolve(true);
    }
  };
};
