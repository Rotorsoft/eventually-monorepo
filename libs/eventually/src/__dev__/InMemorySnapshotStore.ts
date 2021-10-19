import { app } from "..";
import { SnapshotStore } from "../interfaces";

const _store: Record<string, any> = {};
export const InMemorySnapshotStore = (): SnapshotStore => {

  return {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    init: async ()=> {},
    
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    close: async () => {},

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
