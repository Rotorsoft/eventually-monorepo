import {
  log,
  type AggQuery,
  type ProjectorStore,
  type State,
  dispose
} from "@rotorsoft/eventually";
import * as firestore from "./firestore";

export const FirestoreProjectorStore = <S extends State>(
  collection: string
): ProjectorStore<S> => {
  const db = firestore.create();
  const name = `FirestoreStore:${collection}`;

  const store: ProjectorStore<S> = {
    name,
    dispose: () => firestore.dispose(db),
    seed: async () => {},
    drop: () => firestore.drop(db, collection),

    load: (ids) => {
      // TODO await loading records by id
      console.log({ ids });
      throw Error("Not implemented");
    },

    commit: (map, watermark) => {
      // TODO await steps
      // - handle filtered deletes
      // - handle filtered updates
      // - prepare patched records (upserts and deletes)
      // - connect
      // - open transaction
      // - apply patches
      // - commit or rollback transaction
      // - release connection
      console.log({ map, watermark });
      throw Error("Not implemented");
    },

    query: (query) => {
      // TODO await query results
      console.log({ query });
      throw Error("Not implemented");
    },

    agg: (query: AggQuery<S>) => {
      // TODO await query results
      console.log({ query });
      throw Error("Not implemented");
    }
  };

  log().info(`[${process.pid}] ✨ ${store.name}`);
  dispose(() => {
    if (store.dispose) {
      log().info(`[${process.pid}] ♻️ ${store.name}`);
      return store.dispose();
    }
    return Promise.resolve();
  });

  return store;
};
