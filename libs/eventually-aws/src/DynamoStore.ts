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
  type Message,
  type Messages,
  type Store,
  type StoreStat,
  ConcurrencyError
} from "@rotorsoft/eventually";
import { config } from "./config";

export const DynamoStore = (table: string): Store => {
  const client = new DynamoDBClient({
    region: config.aws.region,
    endpoint: config.aws.dynamo?.endpoint,
    credentials: config.aws.credentials
  });
  const name = `DynamoStore:${table}`;

  return {
    name,
    dispose: () => {
      client.destroy();
      return Promise.resolve();
    },

    seed: async () => {
      /**
       * Dynamo Notes:
       * - The distributed nature of DynamoDb makes it a very bad choice for a generic event store.
       * - Existing solutions use a combination of native tables, lambdas, and dynamo streams, thus creating an automatic vendor lock-in.
       * - A natural schema for the write side would be something like { PartitionKey:Stream, OrderKey:Version },
       * but there is no efficient method to query the entire table (only very expensive full scans).
       * - In this implementation, we use a constant (dummy) partition key as the only practical solution to complete the project,
       * but this is not recommended at all.
       */
      const store = await client.send(
        new CreateTableCommand({
          TableName: table,
          KeySchema: [
            { AttributeName: "GlobalPartition", KeyType: "HASH" },
            { AttributeName: "GlobalId", KeyType: "RANGE" }
          ],
          AttributeDefinitions: [
            { AttributeName: "GlobalPartition", AttributeType: "S" },
            { AttributeName: "GlobalId", AttributeType: "N" },
            { AttributeName: "StreamId", AttributeType: "S" },
            { AttributeName: "Version", AttributeType: "N" }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          },
          GlobalSecondaryIndexes: [
            {
              IndexName: "StreamIndex",
              Projection: { ProjectionType: "ALL" },
              KeySchema: [
                { AttributeName: "StreamId", KeyType: "HASH" },
                { AttributeName: "Version", KeyType: "RANGE" }
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
    },

    reset: async (): Promise<void> => {
      try {
        const result = await client.send(
          new DeleteTableCommand({ TableName: table })
        );
        log().info(`${name}.reset`, result);
      } catch {
        //ignore when not found
      }
    },

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
      // TODO: Evaluate other filters
      if (before) throw Error("Query by before not implemented");
      if (created_before)
        throw Error("Query by created_before not implemented");
      if (created_after) throw Error("Query by created_after not implemented");
      if (actor) throw Error("Query by actor not implemented");
      if (correlation) throw Error("Query by correlation not implemented");

      // use stream index when loading
      const command = stream
        ? new QueryCommand({
            TableName: table,
            IndexName: "StreamIndex",
            KeyConditionExpression:
              "StreamId = :StreamId AND Version >= :Version",
            ExpressionAttributeValues: {
              [":StreamId"]: { S: stream },
              [":Version"]: { N: "0" }
            },
            Limit: limit
          })
        : new QueryCommand({
            TableName: table,
            KeyConditionExpression:
              "GlobalPartition = :GlobalPartition AND GlobalId > :GlobalId",
            ExpressionAttributeValues: {
              [":GlobalPartition"]: { S: "Events" },
              [":GlobalId"]: {
                N: typeof after !== "undefined" ? after.toString() : "-1"
              }
            },
            Limit: limit
          });

      try {
        const response = await client.send(command);

        // TODO: stream records to avoid storing the entire resultset in memory
        response.Items?.forEach((item) => {
          if (!names || names.includes(item.Name.S!)) {
            const created = new Date(item.Created.S!);
            callback({
              id: Number.parseInt(item.GlobalId.N!),
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
      } catch (error) {
        log().error(error);
        return 0;
      }
    },

    commit: async <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      //TODO: actor concurrency (secondary index)

      // get last global id
      const response = await client.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "GlobalPartition = :GlobalPartition",
          ExpressionAttributeValues: {
            [":GlobalPartition"]: { S: "GlobalId" }
          },
          Limit: 1
        })
      );
      const lastId = +(response.Items?.at(0)?.GlobalId?.N ?? 0);
      const newId = lastId + events.length;
      const incrementId: TransactWriteItem = {
        Put: {
          TableName: table,
          Item: {
            GlobalPartition: { S: "GlobalId" },
            GlobalId: { N: newId.toString() }
          },
          ConditionExpression:
            "attribute_not_exists(GlobalId) OR GlobalId = :LastId",
          ExpressionAttributeValues: {
            [":LastId"]: { N: lastId.toString() }
          }
        }
      };

      const version = (expectedVersion ?? -1) + 1;
      const committed: CommittedEvent<E>[] = events.map((e, i) => ({
        ...e,
        id: lastId + i,
        stream,
        version: version + i,
        created: new Date(),
        metadata
      }));
      const items = committed.map((e, i) => {
        const createdISO = e.created.toISOString();
        const item: TransactWriteItem = {
          Put: {
            TableName: table,
            Item: {
              GlobalPartition: { S: "Events" },
              GlobalId: { N: (lastId + i).toString() },
              StreamId: { S: stream },
              Version: { N: e.version.toString() },
              Created: { S: createdISO },
              Name: { S: e.name },
              Data: { S: JSON.stringify(e.data) },
              Actor: { S: metadata.causation.command?.actor?.id ?? "" },
              Correlation: { S: metadata.correlation },
              Causation: { S: JSON.stringify(metadata.causation) }
            }
          }
        };
        return item;
      });

      try {
        const tx = new TransactWriteItemsCommand({
          TransactItems: [incrementId].concat(items)
        });
        await client.send(tx);
        return committed;
      } catch (error) {
        log().error(error);
        // not exactly the last Id!
        throw new ConcurrencyError(lastId, events, expectedVersion ?? 0);
      }
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO stats projection
      throw Error("Not implemented");
    }
  };
};
