import { ProjectionStore } from "../interfaces";
import { CommittedEventWithSource, Payload, Projection } from "../types";

/**
 * Basic in-memory dictionary of projections indexed by source
 * @returns store
 */
export const InMemoryProjectionStore = (): ProjectionStore => {
  let _store: Record<string, Projection<Payload>> = {};

  return {
    name: "InMemoryProjectionStore",
    seed: () => undefined,
    dispose: () => {
      _store = {};
      return Promise.resolve();
    },
    load: <M extends Payload>(event: CommittedEventWithSource) =>
      Promise.resolve(
        (_store[event.source] || { watermarks: {} }) as Projection<M>
      ),
    commit: <M extends Payload>(event: CommittedEventWithSource, state: M) => {
      const watermark: Record<string, number> = {};
      watermark[event.source] = event.id;
      const snapshot = (_store[event.source] = {
        state,
        watermarks: { ...watermark }
      });
      return Promise.resolve(snapshot);
    },
    query: <M extends Payload>() => {
      return Promise.resolve(Object.values(_store).map((p) => p.state as M));
    }
  };
};
