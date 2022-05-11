import { app } from "..";
import { SnapshotStore } from "../interfaces";

export const InMemorySnapshotStore = (): SnapshotStore => {
  let _store: Record<string, any> = {};

  return {
    name: "InMemoryStore",
    dispose: () => {
      _store = {};
      return Promise.resolve();
    },

    seed: () => undefined,

    read: (stream) => {
      _store[stream] &&
        app().log.trace("white", `Snapshot loaded for stream ${stream}`);
      return Promise.resolve(_store[stream]);
    },

    upsert: (stream, data) => {
      _store[stream] = data;
      app().log.trace("white", `Snapshot created for stream ${stream}`);
      return Promise.resolve();
    }
  };
};
