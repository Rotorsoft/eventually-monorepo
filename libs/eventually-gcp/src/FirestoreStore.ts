import { Firestore, Transaction } from "@google-cloud/firestore";
import { CommittedEvent, Message, Payload, Store } from "@rotorsoft/eventually";
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
      const events = await db
        .collection(`streams/${id}/events`)
        .orderBy("version", "asc")
        .get();
      events.docs.map((doc) => {
        const { version, data } = doc.data();
        reducer({
          eventId: 1, // TODO fix this
          aggregateId: id,
          aggregateVersion: version.toString(),
          name: doc.id.substr(7),
          createdAt: doc.createTime.toDate(),
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
          const lastQuery = db
            .collection(`streams/${id}/events`)
            .orderBy("version", "desc")
            .limit(1);
          const lastSnap = await transaction.get(lastQuery);
          const last = lastSnap.docs[0]?.data() || {
            version: -1
          };

          if (expectedVersion && last.version != expectedVersion)
            throw Error("Concurrency Error");

          const version = (last.version as number) + 1;

          const newRef = db.doc(
            `streams/${id}/events/${version
              .toString()
              .padStart(6, "0")}:${name}`
          );
          transaction.set(newRef, { version, data });

          return {
            eventId: 1, // TODO fix this
            aggregateId: id,
            aggregateVersion: version.toString(),
            createdAt: new Date(),
            name,
            data
          };
        }
      );
    },

    subscribe: async (event: string, from?: number): Promise<string> => {
      const subscription = await db
        .collection("subscriptions")
        .add({ event, cursor: from || -1 });
      return subscription.id;
    },

    // TODO test this
    poll: async (
      subscription: string,
      limit = 1
    ): Promise<CommittedEvent<string, Payload>[]> => {
      const sub = await db.collection("subscriptions").doc(subscription).get();
      if (!sub.exists) throw Error(`Subscription ${subscription} not found`);
      const { event, cursor } = sub.data();

      const events = await db
        .collection("events")
        .orderBy("id", "asc")
        .where("name", "==", event)
        .where("id", ">", cursor)
        .limit(limit)
        .get();
      return events.docs.map((doc) => {
        const { version, data } = doc.data();
        return {
          eventId: 1, // TODO fix this
          aggregateId: doc.id,
          aggregateVersion: version.toString(),
          name: doc.id.substr(7),
          createdAt: doc.createTime.toDate(),
          data
        };
      });
    },

    // TODO test this
    ack: async (subscription: string, id: number): Promise<boolean> => {
      await db
        .collection("subscriptions")
        .doc(subscription)
        .set({ cursor: id }, { merge: true });
      return true;
    }
  };
};
