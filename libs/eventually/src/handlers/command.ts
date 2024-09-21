import { randomUUID } from "crypto";
import { app, log } from "../ports";
import {
  AggregateFactory,
  InvariantError,
  RegistrationError,
  type CommittedEventMetadata,
  type Message,
  type Messages,
  type Snapshot,
  type State
} from "../types";
import { validateMessage } from "../utils/validation";
import message from "./message";

/**
 * Validates and handles command message
 * @param command the command message
 * @param metadata the optional metadata of the event that triggered this command
 * @returns last snapshot
 */
export default async function command<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  command: Message<C>,
  metadata?: CommittedEventMetadata
): Promise<Snapshot<S, E> | undefined> {
  const validated = validateMessage(command);
  const { name, stream, expectedVersion, actor } = command;
  if (!stream) throw new Error("Missing target stream");

  const msg = app().messages.get(name);
  if (!msg?.handlers.length) throw new RegistrationError(command);

  const factory = app().artifacts.get(msg.handlers[0])
    ?.factory as unknown as AggregateFactory<S, C, E>;
  if (!factory) throw new RegistrationError(command);

  log().blue().trace(`\n>>> ${factory.name}`, command, metadata);

  const artifact = factory(stream);
  Object.setPrototypeOf(artifact, factory as object);

  const snapshots = await message<S, C, E>(
    factory,
    artifact,
    { stream },
    ({ state }) => {
      if ("given" in artifact && artifact.given) {
        const invariants = artifact.given[name] || [];
        invariants.forEach((invariant) => {
          if (!invariant.valid(state, actor))
            throw new InvariantError<C>(
              name,
              command.data,
              { stream, expectedVersion, actor },
              invariant.description
            );
        });
      }
      return artifact.on[name](validated.data, state, actor);
    },
    {
      correlation: metadata?.correlation || randomUUID(),
      causation: {
        ...metadata?.causation,
        command: { name, stream, expectedVersion, actor }
        // TODO: flag to include command.data in metadata, not included by default to avoid duplicated payloads
      }
    }
  );
  return snapshots.at(-1);
}
