import { poll } from "../handlers";
import { STATE_EVENT, type Broker } from "../interfaces";
import { app, store } from "../ports";
import { scheduler } from "../scheduler";
import type {
  ArtifactMetadata,
  ArtifactType,
  EventHandlerFactory
} from "../types";
import { sleep } from "../utils";

const event_handler_types: Array<ArtifactType> = [
  "policy",
  "process-manager",
  "projector"
];

const drainConsumer = async (
  consumer: ArtifactMetadata,
  timeout: number,
  limit: number
): Promise<void> => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const responses = await poll(
      consumer.factory as EventHandlerFactory,
      consumer.inputs.map((input) => input.name),
      limit,
      timeout
    );
    if (responses.length < limit) break;
    if (responses.at(-1)?.error) break;
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
      v.inputs.at(0)?.scope === "private"
  );

  const drain = (delay?: number): void => {
    schedule.push({
      id: "drain",
      action: async (): Promise<boolean> => {
        for (let i = 0; i < consumers.length; i++) {
          await drainConsumer(consumers[i], timeout, limit);
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
        const { id, stream, name, metadata } = snapshot.event!;
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
          }
        );
      }
    }
    drain(throttle);
  });

  return {
    name,
    dispose: () => Promise.resolve(),
    poll: drain,
    drain: async () => {
      drain();
      await sleep(100);
      await schedule.stop();
    }
  };
};
