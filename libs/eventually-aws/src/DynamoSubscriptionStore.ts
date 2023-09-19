import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import {
  log,
  store,
  type CommittedEvent,
  type Lease,
  type Messages,
  type PollOptions,
  type Subscription,
  type SubscriptionStore
} from "@rotorsoft/eventually";
import { randomUUID } from "crypto";
import { config } from "./config";

/**
 * For demo purposes only. There are more efficient stores to handle the high read/write traffic.
 */
export const DynamoSubscriptionStore = (table: string): SubscriptionStore => {
  const client = new DynamoDBClient({
    region: config.aws.region,
    endpoint: config.aws.dynamo?.endpoint,
    credentials: config.aws.credentials
  });
  const name = `DynamoSubscriptionStore:${table}`;

  return {
    name,
    dispose: async () => {
      client.destroy();
      return Promise.resolve();
    },

    seed: async () => {
      const response = await client.send(
        new CreateTableCommand({
          TableName: table,
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
      log().info(`${name}.seed`, response);
    },

    drop: async (): Promise<void> => {
      try {
        await client.send(new DeleteTableCommand({ TableName: table }));
      } catch {
        //ignore when not found
      }
    },

    poll: async <E extends Messages>(
      consumer: string,
      { names, timeout, limit }: PollOptions
    ): Promise<Lease<E> | undefined> => {
      const response = await client.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "Consumer = :Consumer",
          ExpressionAttributeValues: { [":Consumer"]: { S: consumer } }
        })
      );
      const item = response.Items?.at(0);
      const subscription: Subscription = item
        ? {
            consumer,
            lease: item.Lease.S,
            expires: item.Expires.S ? new Date(item.Expires.S) : undefined,
            watermark: Number.parseInt(item.Watermark.S!)
          }
        : { consumer, watermark: -1 };

      // block competing consumers while existing lease is valid
      if (
        subscription.lease &&
        subscription.expires &&
        subscription.expires > new Date()
      )
        return undefined;

      // get events after watermark
      const events: CommittedEvent<E>[] = [];
      await store().query<E>((e) => events.push(e), {
        after: subscription.watermark,
        limit,
        names
      });

      // create a new lease when events found
      if (!events.length) return;

      const lease = randomUUID();
      const expires = new Date(Date.now() + timeout);
      if (item && subscription.lease)
        await client.send(
          new UpdateItemCommand({
            TableName: table,
            Key: {
              Consumer: { S: consumer }
            },
            UpdateExpression: "SET Lease = :NewLease, Expires = :Expires",
            ConditionExpression: "Lease = :OldLease",
            ExpressionAttributeValues: {
              [":OldLease"]: { S: subscription.lease },
              [":NewLease"]: { S: lease },
              [":Expires"]: { S: expires.toISOString() }
            }
          })
        );
      else
        await client.send(
          new PutItemCommand({
            TableName: table,
            Item: {
              Consumer: { S: consumer },
              Lease: { S: lease },
              Expires: { S: expires.toISOString() }
            },
            ConditionExpression: "attribute_not_exists(Lease)"
          })
        );

      return {
        consumer,
        watermark: subscription.watermark,
        lease,
        expires,
        events
      } as Lease<E>;
    },

    ack: async <E extends Messages>(lease: Lease<E>, watermark: number) => {
      await client.send(
        new UpdateItemCommand({
          TableName: table,
          Key: {
            Consumer: { S: lease.consumer }
          },
          UpdateExpression: "SET Watermark = :Watermark REMOVE Lease, Expires",
          ConditionExpression: "Lease = :Lease AND Expires > :Now",
          ExpressionAttributeValues: {
            [":Lease"]: { S: lease.lease },
            [":Watermark"]: { S: watermark.toString() },
            [":Now"]: { S: new Date().toISOString() }
          }
        })
      );
      return true;
    },

    subscriptions: async () => {
      const response = await client.send(
        new QueryCommand({
          TableName: table
        })
      );
      return (
        response.Items?.map((item) => ({
          consumer: item.Consumer.S!,
          watermark: Number.parseInt(item.Watermark.S!),
          lease: item.Lease?.S,
          expires: item.Expires?.S ? new Date(item.Expires.S) : undefined
        })) ?? []
      );
    }
  };
};
