import { app } from "..";
import { SnapshotStore } from "../interfaces";

let _store: Record<string, any> = {};
export const InMemorySnapshotStore = (): SnapshotStore => ({
  init: async () => {
    _store = {};
    return Promise.resolve();
  },

  close: async () => {
    _store = {};
    return Promise.resolve();
  },

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
});
