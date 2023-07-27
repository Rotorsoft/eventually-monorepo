import {
  command,
  event,
  invoke,
  load,
  project,
  query,
  read
} from "../handlers";
import type { Disposable } from "../interfaces";
import type {
  Client,
  CommandHandlerFactory,
  CommandTarget,
  Messages,
  Snapshot,
  State
} from "../types";
import { bind } from "../utils";

/**
 * @category Adapters
 * @remarks In-memory client
 */
export const InMemoryClient = (): Client & Disposable => ({
  name: "InMemoryClient",
  dispose: () => Promise.resolve(),
  invoke,
  command: <S extends State, C extends Messages, E extends Messages>(
    factory: CommandHandlerFactory<S, C, E>,
    name: keyof C,
    data: Readonly<C[keyof C]>,
    target?: CommandTarget
  ): Promise<Snapshot<S, E>[]> => command(bind(name, data, target)),
  event,
  load,
  query,
  project,
  read
});
