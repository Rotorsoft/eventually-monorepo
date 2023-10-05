import {
  store,
  type CommittedEvent,
  type Lease,
  type Messages,
  type PollOptions,
  type Subscription,
  type SubscriptionStore
} from "@rotorsoft/eventually";
import { randomUUID } from "crypto";
import * as firestore from "./firestore";

/**
 * For demo purposes only. There are more efficient stores to handle the high read/write traffic.
 */
export const FirestoreSubscriptionStore = (
  collection: string
): SubscriptionStore => {
  const db = firestore.create();
  const name = `FirestoreSubscriptionStore:${collection}`;

  return {
    name,
    dispose: () => firestore.dispose(db),
    seed: async () => {},
    drop: () => firestore.drop(db, collection),

    poll: async <E extends Messages>(
      consumer: string,
      { names, timeout, limit }: PollOptions
    ): Promise<Lease<E> | undefined> => {
      return await db.runTransaction(async (tx) => {
        const ref = db.doc(`/${collection}/${consumer}`);
        const doc = await tx.get(ref);
        const subscription: Subscription = (doc.data() as Subscription) ?? {
          consumer,
          watermark: -1
        };

        // block competing consumers while existing lease is valid
        if (
          subscription.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        )
          return;

        // get events after watermark
        const events: CommittedEvent<E>[] = [];
        await store().query<E>((e) => events.push(e), {
          after: subscription.watermark,
          limit,
          names
        });
        if (!events.length) return;

        const lease = {
          lease: randomUUID(),
          expires: new Date(Date.now() + timeout)
        };
        tx.set(ref, lease, { merge: true });
        return { ...subscription, ...lease, events };
      });
    },

    ack: async <E extends Messages>(lease: Lease<E>, watermark: number) => {
      return await db.runTransaction(async (tx) => {
        const ref = db.doc(`/${collection}/${lease.consumer}`);
        const doc = await tx.get(ref);
        const subscription: Subscription = (doc.data() as Subscription) ?? {
          consumer: lease.consumer,
          watermark: -1
        };

        // updates subscription while lease is still valid
        if (
          subscription.lease &&
          subscription.lease === lease.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        ) {
          tx.set(
            ref,
            { watermark, lease: undefined, expires: undefined },
            { merge: true }
          );
          return true;
        }
        return false;
      });
    },

    subscriptions: async () => {
      return (await db.collection(`/${collection}`).get())
        .docs as unknown as Subscription[];
    }
  };
};
