import { log } from "../ports";
import { SnapshotStore } from "../interfaces";

/**
 * @category Adapters
 * @remarks In-memory snapshot store
 */
export const InMemorySnapshotStore = (threshold = 100): SnapshotStore => {
  let _store: Record<string, any> = {};

  return {
    name: "InMemoryStore",
    dispose: () => {
      _store = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    threshold,

    read: (stream) => {
      _store[stream] && log().trace(`Snapshot loaded for stream ${stream}`);
      return Promise.resolve(_store[stream]);
    },

    upsert: (stream, data) => {
      _store[stream] = data;
      log().trace(`Snapshot created for stream ${stream}`);
      return Promise.resolve();
    }
  };
};
