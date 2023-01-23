import { event, project } from "../handlers";
import { Broker } from "../interfaces";
import { app, log, store } from "../ports";
import { scheduler } from "../scheduler";
import {
  ArtifactMetadata,
  ArtifactType,
  CommittedEvent,
  EventHandlerFactory,
  Messages,
  PolicyFactory,
  ProjectorFactory
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
        consumer.inputs,
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

export const InMemorySyncBroker = (timeout = 100, limit = 5): Broker => ({
  name: "InMemorySyncBroker",
  dispose: () => Promise.resolve(),
  poll: () => poll(timeout, limit)
});

export const InMemoryAsyncBroker = (
  pollingFrequency = 60 * 1000,
  timeout = 5000,
  limit = 25
): Broker => {
  const name = "InMemoryAsyncBroker";
  const schedule = scheduler(name);

  const action = async (): Promise<boolean> => {
    try {
      log().magenta().trace("async broker polling...");
      const more = await poll(timeout, limit);
      schedule.push({
        id: "poll",
        action,
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
      consumers().length && schedule.push({ id: "poll", action });
      return Promise.resolve(false);
    }
  };
};
