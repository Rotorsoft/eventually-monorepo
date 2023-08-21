import { STATE_EVENT } from "../interfaces";
import { log, store } from "../ports";
import type {
  AggregateFactory,
  CommittedEvent,
  Messages,
  Reducible,
  Snapshot,
  State
} from "../types";
import { patch } from "../utils";

/**
 * Reduces artifact from store
 * @param reducible the reducible artifact
 * @param id the reducible id (agg:stream or processmanager:actor)
 * @param callback optional reduction predicate
 * @returns a snapshot
 */
export async function reduce<S extends State, E extends Messages>(
  reducible: Reducible<S, E>,
  id: { stream?: string; actor?: string },
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> {
  const reducer = reducible.reducer || patch;

  let state = reducible.init();
  let applyCount = 0;
  let stateCount = 0;
  let event: CommittedEvent<E> | undefined;

  await store().query<E>(
    (e) => {
      event = e;
      if (e.name === STATE_EVENT) {
        if (id.stream) {
          // only aggregates can reduce state events
          state = e.data as S;
          stateCount++;
        }
      } else if (reducible.reduce[e.name]) {
        state = reducer(state, reducible.reduce[e.name](state, e)) as S;
        applyCount++;
      }
      callback && callback({ event, state, applyCount, stateCount });
    },
    { ...id, loading: !!id.stream }
  );

  log()
    .gray()
    .trace(`   ... ${id.stream ?? id.actor} loaded ${applyCount} event(s)`);

  return { event, state, applyCount, stateCount };
}

/**
 * Loads aggregate from store
 * @param factory the aggregate factory
 * @param stream the aggregate id (stream)
 * @param callback optional reduction predicate
 * @returns current snapshot
 */
export async function load<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: AggregateFactory<S, C, E>,
  stream: string,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> {
  const reducible = factory(stream);
  Object.setPrototypeOf(reducible, factory as object);
  return reduce<S, E>(reducible, { stream }, callback);
}
