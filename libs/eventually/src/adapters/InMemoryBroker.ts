import { event, project } from "../handlers";
import { Broker } from "../interfaces";
import { app, log, store } from "../ports";
import { scheduler } from "../scheduler";
import {
  ArtifactType,
  CommittedEvent,
  EventHandlerFactory,
  ProjectorFactory
} from "../types";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];

const watermarks: Record<string, number> = {};
const handle = async (
  events: Array<CommittedEvent | undefined>
): Promise<void> => {
  for (const e of events) {
    if (e) {
      try {
        const msg = app().messages[e.name];
        for (const handler of msg.handlers) {
          if ((watermarks[handler] || -1) < e.id) {
            const artifact = app().artifacts[handler];
            artifact.type === "projector"
              ? await project(artifact.factory as ProjectorFactory, e)
              : await event(artifact.factory as EventHandlerFactory, e);
            const watermark = { [handler]: e.id };
            await store().set_watermarks(watermark);
            Object.assign(watermarks, watermark);
          }
        }
      } catch (error) {
        log().error(error);
      }
    }
  }
};

export const InMemorySyncBroker = (): Broker => ({
  name: "InMemorySyncBroker",
  dispose: () => Promise.resolve(),
  start: () => Promise.resolve(),
  on: async (events: Array<CommittedEvent | undefined>) => handle(events)
});

export const InMemoryAsyncBroker = (
  batchSize = 100,
  pollingFrequency = 60 * 1000
): Broker => {
  const name = "InMemoryAsyncBroker";
  const broker_loop = scheduler(name);

  const pump = async (): Promise<boolean> => {
    try {
      log().magenta().trace("async broker pump...", watermarks);
      const after = Math.min(...Object.values(watermarks));
      const events: CommittedEvent[] = [];
      await store().query((e) => events.push(e), { after, limit: batchSize });
      await handle(events);
      broker_loop.push({
        id: "continue",
        action: pump,
        delay: events.length === batchSize ? 100 : pollingFrequency
      });
      return true;
    } catch (error) {
      log().error(error);
      return false;
    }
  };

  return {
    name,
    dispose: () => broker_loop.stop(),
    start: async () => {
      const handlers = Object.entries(app().artifacts)
        .filter(
          ([, v]) => event_handler_types.includes(v.type) && v.inputs.length
        )
        .map(([k]) => k);
      if (handlers.length) {
        const stored_watermarks = await store().get_watermarks();
        let last_id = -1;
        await store().query((e) => (last_id = e.id), {
          backward: true,
          limit: 1
        });
        // TODO: decide if new handlers should start from event 0 or last event
        handlers.forEach(
          (h) => (watermarks[h] = stored_watermarks[h] || last_id)
        );
        broker_loop.push({
          id: "start",
          action: pump
        });
      }
    },
    on: () => {
      Object.keys(watermarks).length &&
        broker_loop.push({
          id: "events",
          action: pump
        });
      return Promise.resolve();
    }
  };
};
