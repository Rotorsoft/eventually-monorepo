import {
  agg,
  command,
  event,
  invoke,
  load,
  project,
  query,
  read
} from "../handlers";
import type { Disposable } from "../interfaces";
import type { Client } from "../types";

/**
 * @category Adapters
 * @remarks In-memory client
 */
export const InMemoryClient = (): Client & Disposable => ({
  name: "InMemoryClient",
  dispose: () => Promise.resolve(),
  invoke,
  command: (_, name, data, target, skipValidation) =>
    command({ name, data, ...target }, undefined, skipValidation),
  event,
  load,
  query,
  project,
  read,
  agg
});
