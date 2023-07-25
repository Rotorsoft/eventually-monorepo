import { drain } from "../handlers";
import { STATE_EVENT, type Broker } from "../interfaces";
import { app, log, store } from "../ports";
import { scheduler } from "../scheduler";
import type { ArtifactType, EventHandlerFactory } from "../types";
import { sleep } from "../utils";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];

/**
 * @category Adapters
 * @remarks In-memory broker connects private event handlers with events being produced locally
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

  // connect private event handlers only
  // NOTE: public consumers should be connected by an external broker service
  const consumers = [...app().artifacts.values()].filter(
    (v) =>
      event_handler_types.includes(v.type) &&
      v.inputs.length &&
      v.inputs.at(0)?.scope === "private"
  );

  const _drain = (delay?: number): void => {
    schedule.push({
      id: "drain",
      action: async (): Promise<boolean> => {
        for (let i = 0; i < consumers.length; i++) {
          const c = consumers[i];
          const { count, error } = await drain(
            c.factory as EventHandlerFactory,
            c.inputs.map((input) => input.name),
            timeout,
            limit
          );
          count &&
            log()
              .gray()
              .trace(`~~~ ${c.factory.name} drained ${count} events...`);
          error && log().error(error);
        }
        return true;
      },
      delay
    });
  };

  // subscribe broker to commit events
  app().on("commit", async ({ factory, snapshot }) => {
    // commits STATE_EVENT - artifact must be configured in app builder
    if (snapshot) {
      const commit = app().commits.get(factory.name);
      if (commit && commit(snapshot)) {
        try {
          const { id, stream, name, metadata, version } = snapshot.event!;
          return await store().commit(
            stream,
            [
              {
                name: STATE_EVENT,
                data: snapshot.state
              }
            ],
            {
              correlation: metadata.correlation,
              causation: { event: { id, name, stream } }
            },
            version // IMPORTANT! - state events should be committed right after the snapshot's event
          );
        } catch (error) {
          log().error(error);
        }
      }
    }
    _drain(throttle);
  });

  return {
    name,
    dispose: () => Promise.resolve(),
    drain: async () => {
      _drain();
      await sleep(100);
      await schedule.stop();
    }
  };
};
