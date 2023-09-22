import {
  CollectionReference,
  FieldPath,
  Firestore
} from "@google-cloud/firestore";
import {
  ConcurrencyError,
  type AllQuery,
  type CommittedEvent,
  type CommittedEventMetadata,
  type Message,
  type Messages,
  type Store,
  type StoreStat,
  log
} from "@rotorsoft/eventually";
import { config } from "./config";
import { NotSupportedError } from "./NotSupportedError";
import { dropCollection } from "./utils";

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

  const eventsRef = (stream: string): CollectionReference =>
    db.collection(`/${collection}/${stream}/events`);

  return {
    name,
    dispose: async () => {
      await db.terminate();
      return Promise.resolve();
    },

    seed: async () => {},

    drop: () => dropCollection(db, collection),

    query: async <E extends Messages>(
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
        actor,
        correlation
      } = query || {};

      if (!stream)
        throw new NotSupportedError(
          "Global filters are not supported. Filter by stream is required."
        );
      if (
        names ||
        before ||
        created_before ||
        created_after ||
        actor ||
        correlation
      )
        throw new NotSupportedError(
          "Global filters are not supported. Avoid using names, before, created_before, created_after, actor, correlation."
        );

      const ref = eventsRef(stream);
      const q = ref.where(
        FieldPath.documentId(),
        ">=",
        pad(typeof after !== "undefined" ? after + 1 : 0)
      );
      limit && q.limit(limit);
      const snap = await q.get();
      snap.forEach((item) => {
        const { name, data: dataStr, metadata: metadataStr } = item.data();
        const data = JSON.parse(dataStr as string);
        const metadata = JSON.parse(metadataStr as string);
        callback({
          id: item.createTime.toMillis(),
          stream,
          version: Number.parseInt(item.id),
          created: item.createTime.toDate(),
          name,
          data,
          metadata
        } satisfies CommittedEvent<E>);
      });
      return snap.size;
    },

    commit: async <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      const version = (expectedVersion ?? -1) + 1;
      const ref = eventsRef(stream);
      try {
        return await db.runTransaction((tx) =>
          Promise.resolve(
            events.map((e, i) => {
              // TODO: fix date to timestamp conversion issue to avoid stringify
              tx.create(ref.doc(pad(version + i)), {
                version: version + i,
                name: e.name,
                data: JSON.stringify(e.data),
                metadata: JSON.stringify(metadata)
              });
              const created = new Date();
              return {
                ...e,
                id: created.getTime(),
                stream,
                created,
                version: version + i + 1,
                metadata
              } satisfies CommittedEvent<E>;
            })
          )
        );
      } catch (error) {
        log().error(error);
        throw new ConcurrencyError(-1, events, version);
      }
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO await stats
      throw Error("Not implemented");
    }
  };
};
