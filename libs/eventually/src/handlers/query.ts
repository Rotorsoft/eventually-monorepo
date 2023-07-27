import { store } from "../ports";
import type { AllQuery, CommittedEvent } from "../types";

/**
 * Queries the store - all streams
 * @param query query parameters
 * @param callback optional event predicate
 * @returns query summary
 */
export default async function query(
  query: AllQuery,
  callback?: (event: CommittedEvent) => void
): Promise<{
  first?: CommittedEvent;
  last?: CommittedEvent;
  count: number;
}> {
  let first: CommittedEvent | undefined = undefined,
    last: CommittedEvent | undefined = undefined;
  const count = await store().query((e) => {
    !first && (first = e);
    last = e;
    callback && callback(e);
  }, query);
  return { first, last, count };
}
