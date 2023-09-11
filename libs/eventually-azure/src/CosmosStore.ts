import type {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  Store,
  StoreStat
} from "@rotorsoft/eventually";

export const CosmosStore = (table: string): Store => {
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
    name: `CosmosStore:${table}`,
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
    }
  };
};
