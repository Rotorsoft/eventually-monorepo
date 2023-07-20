import { STATE_EVENT } from "../interfaces";
import { app, log, store } from "../ports";
import type {
  AggregateFactory,
  CommittedEvent,
  Messages,
  Reducible,
  ReducibleFactory,
  Snapshot,
  State
} from "../types";
import { clone } from "../utils";

/**
 * Loads reducible artifact from store
 * @param factory the reducible factory
 * @param reducible the reducible artifact
 * @param filter the event filter (stream or actor)
 * @param callback optional reduction predicate
 * @returns current model snapshot
 */
export async function loadReducible<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: ReducibleFactory<S, C, E>,
  reducible: Reducible<S, E>,
  filter: string,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> {
  const reducer = reducible.reducer || clone;
  const type = app().artifacts.get(factory.name)?.type;
  let state = reducible.init();
  let applyCount = 0;
  let stateCount = 0;
  let event: CommittedEvent<E> | undefined;
  await store().query<E>(
    (e) => {
      event = e;
      if (e.name === STATE_EVENT) {
        if (type === "aggregate") {
          state = e.data as S;
          stateCount++;
        }
      } else if (reducible.reduce[e.name]) {
        state = reducer(state, reducible.reduce[e.name](state, e));
        applyCount++;
      }
      callback && callback({ event, state, applyCount, stateCount });
    },
    type === "aggregate" ? { stream: filter, loading: true } : { actor: filter }
  );

  log().gray().trace(`   ... ${filter} loaded ${applyCount} event(s)`);

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
  return loadReducible<S, C, E>(factory, reducible, stream, callback);
}
