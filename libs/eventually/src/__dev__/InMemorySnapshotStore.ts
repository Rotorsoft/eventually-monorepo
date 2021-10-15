import { app } from "..";
import { SnapshotStoreFactory } from "../interfaces";

let _store: Record<string, any> = {};
export const InMemorySnapshotStore: SnapshotStoreFactory = (/* table: string */) => {

  return {
    init: ()=> {
      _store = {};
      return Promise.resolve();
    },

    close: () => {
      _store = {};
      return Promise.resolve();
    },

    read: (stream) => {
      _store[stream] && app().log.trace("white", `Snapshot loaded for stream ${stream}`)
      return Promise.resolve(_store[stream]);
    },

    upsert: (stream, data ) => {
      _store[stream] = data;
      app().log.trace("white", `Snapshot Created for stream ${stream}`)
      return Promise.resolve();
    }
  };
};
