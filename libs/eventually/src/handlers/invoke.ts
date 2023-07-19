import type {
  CommandAdapterFactory,
  Messages,
  Snapshot,
  State
} from "../types";
import { validate } from "../utils";
import command from "./command";

/**
 * Validates and and adapts messages from external systems into internal command invocations
 *
 * **Note:** Can be used as webhooks and anti-corruption layers
 *
 * @param factory the aggregate factory
 * @param stream the aggregate id (stream)
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate
 * @returns current snapshot
 */
export default async function invoke<
  P extends State,
  S extends State,
  C extends Messages,
  E extends Messages
>(factory: CommandAdapterFactory<P, C>, payload: P): Promise<Snapshot<S, E>[]> {
  const adapter = factory();
  const validated = validate(payload, adapter.schemas.message);
  return command(adapter.on(validated));
}
