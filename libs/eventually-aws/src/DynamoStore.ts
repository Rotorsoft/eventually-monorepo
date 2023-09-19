import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  QueryCommand,
  TransactWriteItem,
  TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
  ConcurrencyError,
  log,
  type AllQuery,
  type CommittedEvent,
  type CommittedEventMetadata,
  type Message,
  type Messages,
  type Store,
  type StoreStat
} from "@rotorsoft/eventually";
import { NotSupportedError } from "./NotSupportedError";
import { config } from "./config";

/**
 * This is a partial `Store` implementation due to the limitations imposed by
 * the distributed nature of DynamoDb, mainly around being able to query events in order (all streams)
 * - Solutions will require dynamo streams to deliver ordered events to consumer endpoints (vendor lock-in)
 */
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
      const response = await client.send(
        new CreateTableCommand({
          TableName: table,
          KeySchema: [
            { AttributeName: "StreamId", KeyType: "HASH" },
            { AttributeName: "Version", KeyType: "RANGE" }
          ],
          AttributeDefinitions: [
            { AttributeName: "StreamId", AttributeType: "S" },
            { AttributeName: "Version", AttributeType: "N" }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        })
      );
      log().info(`${name}.seed`, response);
    },

    drop: async (): Promise<void> => {
      try {
        await client.send(new DeleteTableCommand({ TableName: table }));
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

      try {
        const response = await client.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression:
              "StreamId = :StreamId AND Version > :Version",
            ExpressionAttributeValues: {
              [":StreamId"]: { S: stream },
              [":Version"]: {
                N: typeof after !== "undefined" ? after.toString() : "-1"
              }
            },
            Limit: limit
          })
        );

        // TODO: stream records to avoid storing the entire resultset in memory
        response.Items?.forEach((item) => {
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
      const created = new Date();
      const createdISO = created.toISOString();
      const version = (expectedVersion ?? -1) + 1;
      const actor = metadata.causation.command?.actor?.id ?? "";
      const committed: CommittedEvent<E>[] = events.map((e, i) => ({
        ...e,
        id: created.getTime() + i,
        stream,
        version: version + i,
        created,
        metadata
      }));
      const TransactItems = committed.map((e) => {
        const item: TransactWriteItem = {
          Put: {
            TableName: table,
            Item: {
              StreamId: { S: stream },
              Version: { N: e.version.toString() },
              Created: { S: createdISO },
              Name: { S: e.name },
              Data: { S: JSON.stringify(e.data) },
              Actor: { S: actor },
              Correlation: { S: metadata.correlation },
              Causation: { S: JSON.stringify(metadata.causation) }
            }
          }
        };
        return item;
      });
      try {
        const tx = new TransactWriteItemsCommand({
          TransactItems
        });
        await client.send(tx);
        return committed;
      } catch (error) {
        log().error(error);
        throw new ConcurrencyError(-1, events, expectedVersion ?? 0);
      }
    },

    stats: (): Promise<StoreStat[]> => {
      // TODO stats projection
      throw Error("Not implemented");
    }
  };
};
