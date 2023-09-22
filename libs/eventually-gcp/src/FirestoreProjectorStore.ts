import { Firestore } from "@google-cloud/firestore";
import {
  dispose,
  log,
  type AggQuery,
  type ProjectorStore,
  type State
} from "@rotorsoft/eventually";
import { config } from "./config";
import { dropCollection } from "./utils";

export const FirestoreProjectorStore = <S extends State>(
  collection: string
): ProjectorStore<S> => {
  const db = new Firestore({
    projectId: config.gcp.projectId,
    ignoreUndefinedProperties: true,
    host: config.gcp.firestore?.host,
    port: config.gcp.firestore?.port,
    keyFilename: config.gcp.keyFilename
  });
  const name = `FirestoreStore:${collection}`;

  const store: ProjectorStore<S> = {
    name,
    dispose: async () => {
      await db.terminate();
      return Promise.resolve();
    },

    seed: async () => {},

    drop: () => dropCollection(db, collection),

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
