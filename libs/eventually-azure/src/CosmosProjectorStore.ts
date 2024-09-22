import type { AggQuery, ProjectorStore, State } from "@rotorsoft/eventually";
import {
  dispose,
  logAdapterCreated,
  logAdapterDisposed
} from "@rotorsoft/eventually";

export const CosmosProjectorStore = <S extends State>(
  table: string
): ProjectorStore<S> => {
  const store: ProjectorStore<S> = {
    name: `CosmosProjectorStore:${table}`,
    dispose: () => {
      // TODO await dispose resources
      throw Error("Not implemented");
    },

    seed: (schema, indexes) => {
      // TODO await seed store
      console.log({ schema, indexes });
      throw Error("Not implemented");
    },

    drop: () => {
      // TODO await drop store
      throw Error("Not implemented");
    },

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

  logAdapterCreated(store.name);
  dispose(() => {
    if (store.dispose) {
      logAdapterDisposed(store.name);
      return store.dispose();
    }
    return Promise.resolve();
  });

  return store;
};
