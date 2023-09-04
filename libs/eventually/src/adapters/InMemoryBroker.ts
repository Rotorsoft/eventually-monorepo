import { drain } from "../handlers";
import { STATE_EVENT, type Broker } from "../interfaces";
import { app, log, store } from "../ports";
import type { ArtifactType, EventHandlerFactory } from "../types";
import { throttle } from "../utils/utils";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];

/**
 * @category Adapters
 * @remarks In-memory broker connects private event handlers with events being produced locally
 * @param timeout lease expiration time (in ms) when polling the store
 * @param limit max number of events to drain in each try
 * @param delay debounce delay (in ms) to drain
 * @param subscribed to subscribe the broker to commit events - set to false when serverless
 */
export const InMemoryBroker = (options?: {
  timeout?: number;
  limit?: number;
  delay?: number;
  subscribed?: boolean;
}): Broker => {
  const name = "InMemoryBroker";
  const {
    timeout = 5000,
    limit = 10,
    delay = 500,
    subscribed = true
  } = options ?? {};

  // connect private event handlers only
  // NOTE: public consumers should be connected by an external broker service
  const consumers = [...app().artifacts.values()]
    .filter(
      (v) =>
        event_handler_types.includes(v.type) &&
        v.inputs.length &&
        v.inputs.at(0)?.scope === "private"
    )
    .map((md) => ({
      factory: md.factory as EventHandlerFactory,
      names: md.inputs.map((input) => input.name)
    }));

  const drainAll = async (): Promise<void> => {
    for (let i = 0; i < consumers.length; i++) {
      const c = consumers[i];
      const { total, error } = await drain(c.factory, {
        names: c.names,
        timeout,
        limit
      });
      total &&
        log().gray().trace(`~~~ ${c.factory.name} drained ${total} events...`);
      error && log().error(error);
    }
  };
  const __drain = throttle(drainAll, delay);

  // subscribe broker to commit events
  subscribed &&
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
      __drain();
    });

  return {
    name,
    dispose: () => Promise.resolve(),
    drain: drainAll
  };
};
