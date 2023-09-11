import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  QueryCommand,
  TransactWriteItem,
  TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
  log,
  type AllQuery,
  type CommittedEvent,
  type CommittedEventMetadata,
  type Lease,
  type Message,
  type Messages,
  type PollOptions,
  type Store,
  type StoreStat
} from "@rotorsoft/eventually";
import { config } from "./config";

export const DynamoStore = (table: string): Store => {
  const client = new DynamoDBClient({
    region: config.aws.region,
    endpoint: config.aws.dynamo?.endpoint
  });
  const name = `DynamoStore:${table}`;
  const subsName = `${table}-subscriptions`;

  const query = async <E extends Messages>(
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
    const conditions = [];
    const values: any = {};

    if (before) throw Error("Query by before not implemented");
    if (after) throw Error("Query by after not implemented");
    if (created_before) throw Error("Query by created_before not implemented");
    if (created_after) throw Error("Query by created_after not implemented");
    if (actor) throw Error("Query by actor not implemented");
    if (correlation) throw Error("Query by correlation not implemented");

    if (stream) {
      conditions.push("StreamId = :StreamId");
      values[":StreamId"] = { S: stream };
    }
    const command = new QueryCommand({
      TableName: table,
      KeyConditionExpression: conditions.join(" AND "),
      ExpressionAttributeValues: values,
      Limit: limit
    });
    const response = await client.send(command);
    // TODO: stream records to avoid storing the entire resultset in memory
    response.Items?.forEach((item) => {
      if (!names || names.includes(item.Name.S!)) {
        const created = new Date(item.Created.S!);
        callback({
          id: created.getTime(),
          stream: item.StreamId.S!,
          version: Number.parseInt(item.Version.N!),
          created,
          name: item.Name.S!,
          data: JSON.parse(item.Data.S ?? "{}"),
          metadata: {
            correlation: item.Correlation.S!,
            causation: JSON.parse(item.Causation.S ?? "{}")
          }
        });
      }
    });
    return response.Count ?? 0;
  };

  return {
    name,
    dispose: () => {
      client.destroy();
      return Promise.resolve();
    },

    seed: async () => {
      const store = await client.send(
        new CreateTableCommand({
          TableName: table,
          KeySchema: [
            { AttributeName: "StreamId", KeyType: "HASH" },
            { AttributeName: "Version", KeyType: "RANGE" }
          ],
          AttributeDefinitions: [
            { AttributeName: "StreamId", AttributeType: "S" },
            { AttributeName: "Version", AttributeType: "N" },
            { AttributeName: "Hour", AttributeType: "S" },
            { AttributeName: "Created", AttributeType: "S" }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          },
          GlobalSecondaryIndexes: [
            {
              IndexName: "HourIndex",
              Projection: {
                ProjectionType: "ALL"
              },
              KeySchema: [
                { AttributeName: "Hour", KeyType: "HASH" },
                { AttributeName: "Created", KeyType: "RANGE" }
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
              }
            }
          ]
        })
      );
      log().info(`${name}.seed`, store);

      const subscriptions = await client.send(
        new CreateTableCommand({
          TableName: subsName,
          KeySchema: [{ AttributeName: "Consumer", KeyType: "HASH" }],
          AttributeDefinitions: [
            { AttributeName: "Consumer", AttributeType: "S" }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        })
      );
      log().info(`${name}.seed`, subscriptions);
    },

    query,

    commit: async <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      //TODO: actor concurrency (secondary index)

      const version = (expectedVersion ?? -1) + 1;
      const committed: CommittedEvent<E>[] = events.map((e, i) => ({
        ...e,
        id: Date.now(),
        stream,
        version: version + i,
        created: new Date(),
        metadata
      }));
      const tx = new TransactWriteItemsCommand({
        TransactItems: committed.map((e) => {
          const timestamp = e.created.toISOString();
          const item: TransactWriteItem = {
            Put: {
              TableName: table,
              Item: {
                StreamId: { S: stream },
                Version: { N: e.version.toString() },
                Hour: { S: timestamp.substring(0, 13) },
                Created: { S: timestamp },
                Name: { S: e.name },
                Data: { S: JSON.stringify(e.data) },
                Actor: { S: metadata.causation.command?.actor?.id ?? "" },
                Correlation: { S: metadata.correlation },
                Causation: { S: JSON.stringify(metadata.causation) }
              }
            }
          };
          return item;
        })
      });
      await client.send(tx);
      return committed;
    },

    reset: async (): Promise<void> => {
      const tableNames = [table, subsName];
      for (const TableName of tableNames) {
        try {
          const result = await client.send(
            new DeleteTableCommand({ TableName })
          );
          log().info(`${name}.reset`, result);
        } catch {
          //ignore when not found
        }
      }
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO stats projection
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
