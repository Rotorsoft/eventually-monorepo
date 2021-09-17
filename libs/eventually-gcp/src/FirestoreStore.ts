import { Firestore, Transaction } from "@google-cloud/firestore";
import { Store, CommittedEvent, Message } from "@rotorsoft/eventually";
import { config } from "./config";

const db = new Firestore({
  projectId: config.gcp?.project,
  keyFilename: config.gcp?.keyfilename,
  ignoreUndefinedProperties: true
});

export const FirestoreStore = (): Store => {
  return {
    load: async (
      id: string,
      reducer: (event: CommittedEvent<string, any>) => void
    ): Promise<void> => {
      const eventsRef = db.collection(`streams/${id}/events`);
      const eventsSnap = await eventsRef.orderBy("version", "asc").get();
      eventsSnap.docs.map((doc) => {
        const { version, data } = doc.data();
        reducer({
          id,
          version: version.toString(),
          name: doc.id.substr(7),
          data
        });
      });
    },

    commit: async (
      id: string,
      { name, data }: Message<string, any>,
      expectedVersion?: string
    ): Promise<CommittedEvent<string, any>> => {
      return db.runTransaction(
        async (
          transaction: Transaction
        ): Promise<CommittedEvent<string, any>> => {
          const eventsRef = db.collection(`streams/${id}/events`);
          const lastEventRef = eventsRef.orderBy("version", "desc").limit(1);
          const lastEventSnap = await transaction.get(lastEventRef);
          const lastEvent = lastEventSnap.docs[0]?.data() || {
            version: -1
          };

          if (expectedVersion && lastEvent.version != expectedVersion)
            throw Error("Concurrency Error");

          const version = (lastEvent.version as number) + 1;

          const newEventRef = db.doc(
            `streams/${id}/events/${version
              .toString()
              .padStart(6, "0")}:${name}`
          );
          transaction.set(newEventRef, { version, data });

          return { id, version: version.toString(), name, data };
        }
      );
    }
  };
};
