import type {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Lease,
  Message,
  Messages,
  PollOptions,
  Store,
  StoreStat
} from "@rotorsoft/eventually";

export const FirestoreStore = (table: string): Store => {
  const query = <E extends Messages>(
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
  };

  return {
    name: `FirestoreStore:${table}`,
    dispose: () => {
      // TODO await dispose resources
      throw Error("Not implemented");
    },

    seed: () => {
      // TODO await seed store
      throw Error("Not implemented");
    },

    query,

    commit: <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      // TODO await steps
      // - connect
      // - open transaction
      // - get stream version or -1
      // - check version = expectedVersion or throw ConcurrencyError
      // - check actor concurrency in metadata (expectedCount)
      // - store events
      // - notify system (optional)
      // - commit or rollback transaction
      // - release connection
      console.log({ stream, events, metadata, expectedVersion });
      throw Error("Not implemented");
    },

    reset: (): Promise<void> => {
      // TODO await truncate table
      throw Error("Not implemented");
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO await stats
      throw Error("Not implemented");
    },

    poll: <E extends Messages>(
      consumer: string,
      { names, timeout, limit }: PollOptions
    ): Promise<Lease<E> | undefined> => {
      // TODO await steps
      // - connect
      // - open transaction
      // - get consumer subscription/lease
      // - block when existing lease is still valid
      // - get events after watermark
      // - create new lease when events found
      // - commit or rollback transaction
      // - release connection
      console.log({ consumer, names, timeout, limit });
      throw Error("Not implemented");
    },

    ack: <E extends Messages>(lease: Lease<E>, watermark?: number) => {
      // TODO await steps
      // - connect
      // - open transaction
      // - get consumer subscription/lease
      // - update watermark and release when existing lease is still valid (acked)
      // - commit or rollback transaction
      // - release connection
      // - return if acked
      console.log({ lease, watermark });
      throw Error("Not implemented");
    },

    subscriptions: () => {
      // TODO await get subscriptions/leases
      throw Error("Not implemented");
    }
  };
};
