import { randomUUID } from "crypto";
import { log } from "../ports";
import type {
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  EventResponse,
  Message,
  Messages,
  State
} from "../types";
import { bind, validateMessage } from "../utils";
import command from "./command";
import message from "./message";

/**
 * Validates and handles event message
 * @param factory the event handler factory (policy or process manager)
 * @param event the committed event to be handled
 * @returns response, including command side effects
 */
export default async function event<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  event: CommittedEvent<E>
): Promise<EventResponse<S, C>> {
  log().magenta().trace(`\n>>> ${factory.name}`, event);
  const { data } = validateMessage(event);
  const { id, name, stream } = event;

  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);

  const actor: string = "actor" in artifact ? artifact.actor[name](event) : "";
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomUUID(),
    causation: { event: { name, stream, id } }
  };

  let cmd: Message<C> | undefined;
  const snapshots = await message(
    factory,
    artifact,
    { actor },
    async (snapshot) => {
      cmd = await artifact.on[name](event, snapshot.state);
      if (cmd) {
        // command side effects are handled synchronously, thus event handlers can fail
        await command<S, C, E>(
          {
            ...cmd,
            actor: {
              id: actor || factory.name,
              name: factory.name,
              expectedCount: actor ? snapshot.applyCount : undefined
            }
          },
          metadata
        );
      }
      return [bind(name, data)];
    },
    metadata
  );
  return {
    id,
    command: cmd,
    state: snapshots.at(-1)?.state
  };
}
