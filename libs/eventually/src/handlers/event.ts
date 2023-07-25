import { randomUUID } from "crypto";
import type { ProjectorStore } from "../interfaces";
import { _imps, app, log } from "../ports";
import type {
  Command,
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  EventResponse,
  Messages,
  Policy,
  ProcessManager,
  State
} from "../types";
import { bind, isProjector, validateMessage } from "../utils";
import command from "./command";
import message from "./message";

/**
 * Validates and handles event message
 * @param factory the event handler factory (policy, process manager, or projector)
 * @param events the committed event to be handled
 * @returns response, including command or projection side effects
 */
export default async function event<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  event: CommittedEvent<E>
): Promise<EventResponse<S, C>> {
  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);

  const projector = isProjector(artifact) ? artifact : undefined;
  const color = projector ? "green" : "magenta";
  log()[color]().trace(`\n>>> ${factory.name}`, event);

  const { data } = validateMessage(event);
  const { id, name, stream } = event;

  // ----------------------------------------------------------------
  if (projector) {
    const projection = await projector.on[event.name](event);
    const ps = (app().stores.get(factory.name) as ProjectorStore<S>) || _imps();
    const results = await ps.commit(projection, event.id);
    app().emit("projection", { factory, results });
    log()
      .gray()
      .trace(
        "   ... committed",
        JSON.stringify(projection),
        JSON.stringify(results)
      );
    return { id, projection: results };
  }

  // ----------------------------------------------------------------
  const policy = artifact as Policy<C, E> | ProcessManager<S, C, E>;
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomUUID(),
    causation: { event: { name, stream, id } }
  };
  let cmd: Command<C> | undefined;
  const actor: string = "actor" in artifact ? artifact.actor[name](event) : "";
  const snapshots = await message(
    factory,
    artifact,
    { actor },
    async (snapshot) => {
      cmd = await policy.on[name](event, snapshot.state);
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
