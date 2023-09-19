import { Firestore } from "@google-cloud/firestore";
import {
  ConcurrencyError,
  type AllQuery,
  type CommittedEvent,
  type CommittedEventMetadata,
  type Message,
  type Messages,
  type Store,
  type StoreStat
} from "@rotorsoft/eventually";
import { config } from "./config";

export const FirestoreStore = (collection: string, maxId = 1e6): Store => {
  const padlen = (maxId - 1).toString().length;
  const padstr = "0".repeat(padlen);
  const pad = (id: number): string => {
    const s = id.toString();
    return padstr.substring(0, padlen - s.length).concat(s);
  };

  const db = new Firestore({
    projectId: config.gcp.projectId,
    ignoreUndefinedProperties: true,
    host: config.gcp.firestore?.host,
    port: config.gcp.firestore?.port,
    keyFilename: config.gcp.keyFilename
  });
  const name = `FirestoreStore:${collection}`;

  return {
    name,
    dispose: async () => {
      await db.terminate();
      return Promise.resolve();
    },

    seed: async () => {},

    drop: async (): Promise<void> => {
      try {
        const ref = db.collection(`/${collection}`);
        const col = await ref.get();
        if (!col.empty) await db.recursiveDelete(ref);
      } catch (error) {
        console.error(error);
      }
    },

    query: <E extends Messages>(
      callback: (event: CommittedEvent<E>) => void,
      query?: AllQuery
    ): Promise<number> => {
      const {
        stream,
        names,
        before,
        after,
        limit,
        created_before,
        created_after,
        backward,
        actor,
        correlation,
        loading
      } = query || {};
      console.log({
        stream,
        names,
        before,
        after,
        limit,
        created_before,
        created_after,
        backward,
        actor,
        correlation,
        loading
      });
      // TODO await query results
      throw Error("Not implemented");
    },

    commit: async <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      const ref = db.collection(`/${collection}/${stream}`);
      const version = expectedVersion ?? -1;
      try {
        return await db.runTransaction((tx) =>
          Promise.resolve(
            events.map((e, i) => {
              const id = pad(version + i);
              const committed: CommittedEvent<E> = {
                ...e,
                id: Date.now(),
                stream,
                version: version + i,
                created: new Date(),
                metadata
              };
              tx.create(ref.doc(id), committed);
              return committed;
            })
          )
        );
      } catch {
        throw new ConcurrencyError(-1, events, version);
      }
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO await stats
      throw Error("Not implemented");
    }
  };
};
