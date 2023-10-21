import {
  AttributeValue,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  QueryCommand,
  TransactWriteItem,
  TransactWriteItemsCommand,
  TransactionCanceledException
} from "@aws-sdk/client-dynamodb";
import {
  conditions,
  dispose,
  log,
  type AggQuery,
  type Operator,
  type Projection,
  type ProjectionWhere,
  type ProjectorStore,
  type Schema,
  type State,
  ProjectionRecord
} from "@rotorsoft/eventually";
import { NotSupportedError } from "./NotSupportedError";
import { config } from "./config";

const EQUALS: Operator[] = ["eq", "lte", "gte", "in"];

const dynamoOperators: Record<Operator, string> = {
  eq: "=",
  neq: "<>",
  lt: "<",
  gt: ">",
  lte: "<=",
  gte: ">=",
  in: "IN",
  nin: "NOT IN"
};

type Filter = {
  key: string;
  operator: Operator;
  value: any;
  index: number;
};

const toFilters = (where: ProjectionWhere): Filter[] =>
  Object.entries(where).flatMap(([key, condition]) =>
    conditions(condition!).map(([operator, value], index) => ({
      key,
      operator,
      value,
      index
    }))
  );

const toExpression = (filters: Filter[]): string | undefined => {
  const expression = filters
    .map(({ key, operator, value, index }) => {
      const operation =
        value === null
          ? EQUALS.includes(operator)
            ? "IS NULL"
            : "IS NOT NULL"
          : `${dynamoOperators[operator]} :F_${key}${index ? index : ""}`;
      return `F_${key} ${operation}`;
    })
    .join(" AND ");
  return expression.length ? expression : undefined;
};

const getAttributeValue = (value: any): AttributeValue => {
  if (Array.isArray(value) && value.length) {
    const item = value.at(0);
    return typeof item === "number" ? { NS: value } : { SS: value };
  }
  return typeof value === "number" ? { N: value.toString() } : { S: value };
};

const toAttributeValues = (filters: Filter[]): Record<string, AttributeValue> =>
  Object.assign(
    Object.fromEntries(
      filters.map(({ key, value, index }) => [
        `:F_${key}${index ? index : ""}`,
        getAttributeValue(value)
      ])
    )
  );

/**
 * DynamoDb Projector Store
 *
 * @param table table name
 * @param partitionField field name used as partition key, `id` is always the ordering key
 * @param schema zod schema of projection state using `coerce` utility to help building filter expressions
 * @returns a new store
 */
export const DynamoProjectorStore = <S extends State>(
  table: string,
  partitionField: keyof S,
  schema: Schema<Projection<S>>
): ProjectorStore<S> => {
  const client = new DynamoDBClient({
    region: config.aws.region,
    endpoint: config.aws.dynamo?.endpoint,
    credentials: config.aws.credentials
  });
  const name = `DynamoProjectorStore:${table}`;

  /**
   * Filters must include partition field with eq condition
   */
  const filter = (
    where: ProjectionWhere<State>,
    keyAttributes = false
    //patch?: Patch<State>
  ): {
    Key?: Record<string, AttributeValue>;
    KeyConditionExpression?: string;
    FilterExpression?: string;
    ExpressionAttributeValues: Record<string, AttributeValue>;
  } => {
    if (!(partitionField in where))
      throw Error(
        `Missing partition field "${partitionField.toString()}" in where statement: ${JSON.stringify(
          where
        )}`
      );

    const filters = toFilters(where);
    const filterKeys = filters.filter(
      ({ key }) => key === partitionField || key === "id"
    );
    const filtersNoKeys = filters.filter(
      ({ key }) => key !== partitionField && key !== "id"
    );

    // const UpdateExpression = patch
    //   ? "SET " +
    //   Object.keys(patch)
    //     .map((k) => `F_${k} = :P_${k}`)
    //     .join(", ")
    //   : undefined;

    // TODO: add to attribute values
    // patch
    //   ? Object.fromEntries(
    //       Object.entries(patch).map(([k, v]) => [`:P_${k}`, { S: v }])
    //     )
    //   : {}

    return keyAttributes
      ? {
          Key: toAttributeValues(filterKeys),
          FilterExpression: toExpression(filtersNoKeys),
          ExpressionAttributeValues: toAttributeValues(filtersNoKeys)
        }
      : {
          KeyConditionExpression: toExpression(filterKeys),
          FilterExpression: toExpression(filtersNoKeys),
          ExpressionAttributeValues: toAttributeValues(filters)
        };
  };

  const store: ProjectorStore<S> = {
    name,
    dispose: async () => {
      client.destroy();
      return Promise.resolve();
    },

    seed: async () => {
      const response = await client.send(
        new CreateTableCommand({
          TableName: table,
          KeySchema: [
            {
              AttributeName: `F_${partitionField.toString()}`,
              KeyType: "HASH"
            },
            {
              AttributeName: "F_id",
              KeyType: "RANGE"
            }
          ],
          AttributeDefinitions: [
            {
              AttributeName: `F_${partitionField.toString()}`,
              AttributeType: "S"
            },
            {
              AttributeName: "F_id",
              AttributeType: "S"
            }
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

    load: () => {
      throw new NotSupportedError("Load by ids is not supported");
    },

    commit: async (map, watermark) => {
      const TransactItems: TransactWriteItem[] = [];

      // TODO: Returned counters are not accurate on filtered operations
      let upserted = 0,
        deleted = 0;

      if (map.deletes.length)
        throw new NotSupportedError("Filtered deletes not supported");
      if (map.updates.length)
        throw new NotSupportedError("Filtered updates not supported");

      // patched records
      map.records.forEach((rec, id) => {
        if (!(partitionField in rec))
          throw Error(
            `Missing partition field "${partitionField.toString()}" in record: ${JSON.stringify(
              rec
            )}`
          );
        // upserts when other keys are found in patch
        if (Object.keys(rec).length > 1) {
          upserted++;
          const ExpressionAttributeValues = Object.fromEntries<AttributeValue>(
            Object.entries(rec)
              .filter(([k]) => k !== partitionField && k !== "id")
              .map(([k, v]) => [`:F_${k}`, getAttributeValue(v)])
          );
          ExpressionAttributeValues[":Watermark"] = { N: watermark.toString() };
          TransactItems.push({
            Update: {
              TableName: table,
              Key: {
                [`F_${partitionField.toString()}`]: {
                  S: rec[partitionField.toString()]
                },
                F_id: { S: id }
              },
              ConditionExpression:
                "attribute_not_exists(Watermark) OR Watermark < :Watermark",
              UpdateExpression:
                "SET Watermark = :Watermark, " +
                Object.keys(rec)
                  .filter((k) => k !== partitionField)
                  .map((k) => `F_${k} = :F_${k}`)
                  .join(", "),
              ExpressionAttributeValues
            }
          });
        } else {
          deleted++;
          TransactItems.push({
            Delete: {
              TableName: table,
              Key: {
                [`F_${partitionField.toString()}`]: {
                  S: rec[partitionField.toString()]
                },
                F_id: { S: id }
              },
              ConditionExpression:
                "attribute_not_exists(Watermark) OR Watermark < :Watermark",
              ExpressionAttributeValues: {
                [":Watermark"]: { N: watermark.toString() }
              }
            }
          });
        }
      });

      if (TransactItems.length) {
        //console.log(JSON.stringify(TransactItems, null, 2));
        try {
          await client.send(new TransactWriteItemsCommand({ TransactItems }));
        } catch (error) {
          if (error instanceof TransactionCanceledException) {
            //console.log("tx cancelled for reasons:", error.CancellationReasons);
            return { upserted: 0, deleted: 0, watermark };
          } else throw error;
        }
      }
      return Promise.resolve({ upserted, deleted, watermark });
    },

    /**
     * TODO: Sorting is not supported, only scan index forward flag
     */
    query: async (query) => {
      const {
        KeyConditionExpression,
        FilterExpression,
        ExpressionAttributeValues
      } = filter(query.where!);
      // const Select = query.select?.map((k) => `F_${k.toString()}`).join(", ");
      const command = new QueryCommand({
        TableName: table,
        KeyConditionExpression,
        FilterExpression,
        ExpressionAttributeValues,
        Limit: query.limit
      });
      //console.log(JSON.stringify(command.input, null, 2));
      const response = await client.send(command);
      return (response.Items ?? []).map((item) => {
        const obj = Object.fromEntries(
          Object.entries(item).map(([k, v]) => [k.substring(2), v.S ?? v.N])
        );
        const record: ProjectionRecord<S> = {
          state: schema.parse(obj),
          watermark: Number.parseInt(item.Watermark.N!)
        };
        return record;
      });
    },

    agg: (query: AggQuery<S>) => {
      // TODO await query results
      console.log({ query });
      throw Error("Not implemented");
    }
  };

  log().info(`[${process.pid}] ✨ ${store.name}`);
  dispose(() => {
    if (store.dispose) {
      log().info(`[${process.pid}] ♻️ ${store.name}`);
      return store.dispose();
    }
    return Promise.resolve();
  });

  return store;
};
