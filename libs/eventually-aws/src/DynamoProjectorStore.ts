/**
 * No good compromise found!
 */

// import {
//   AttributeValue,
//   CreateTableCommand,
//   DeleteTableCommand,
//   DynamoDBClient,
//   QueryCommand,
//   TransactWriteItem,
//   TransactWriteItemsCommand
// } from "@aws-sdk/client-dynamodb";
// import {
//   conditions,
//   dispose,
//   log,
//   type AggQuery,
//   type Operator,
//   type Projection,
//   type ProjectionWhere,
//   type ProjectorStore,
//   type Schema,
//   type State,
//   Patch
// } from "@rotorsoft/eventually";
// import { config } from "./config";

// const EQUALS: Operator[] = ["eq", "lte", "gte", "in"];

// const dynamoOperators: Record<Operator, string> = {
//   eq: "=",
//   neq: "<>",
//   lt: "<",
//   gt: ">",
//   lte: "<=",
//   gte: ">=",
//   in: "IN",
//   nin: "NOT IN"
// };

// const filter = (
//   where: ProjectionWhere<State>,
//   patch?: Patch<State>
// ): {
//   ConditionExpression: string;
//   UpdateExpression?: string;
//   ExpressionAttributeValues: Record<string, AttributeValue>;
// } => {
//   const f = Object.entries(where).flatMap(([key, condition]) =>
//     conditions(condition!).map(([operator, value]) => ({
//       key,
//       operator,
//       value
//     }))
//   );
//   const ExpressionAttributeValues = Object.assign(
//     Object.fromEntries(f.map(({ key, value }) => [`:F_${key}`, { S: value }])),
//     patch
//       ? Object.fromEntries(
//           Object.entries(patch).map(([k, v]) => [`:P_${k}`, { S: v }])
//         )
//       : {}
//   );
//   return {
//     ConditionExpression: f
//       .map(({ key, operator, value }) => {
//         const operation =
//           value === null
//             ? EQUALS.includes(operator)
//               ? "IS NULL"
//               : "IS NOT NULL"
//             : `${dynamoOperators[operator]} :F_${key}`;
//         return `F_${key} ${operation}`;
//       })
//       .join(" AND "),
//     UpdateExpression: patch
//       ? "SET " +
//         Object.keys(patch)
//           .map((k) => `F_${k} = :P_${k}`)
//           .join(", ")
//       : undefined,
//     ExpressionAttributeValues
//   };
// };

// export const DynamoProjectorStore = <S extends State>(
//   table: string,
//   schema: Schema<Projection<S>>
// ): ProjectorStore<S> => {
//   const client = new DynamoDBClient({
//     region: config.aws.region,
//     endpoint: config.aws.dynamo?.endpoint,
//     credentials: config.aws.credentials
//   });
//   const name = `DynamoProjectorStore:${table}`;

//   const store: ProjectorStore<S> = {
//     name,
//     dispose: async () => {
//       client.destroy();
//       return Promise.resolve();
//     },

//     seed: async () => {
//       /**
//        * Notes:
//        * - Dummy partition Projector - just to get it working but not recommended
//        * - Id is a regular field - secondary indexes not implemented
//        */
//       const response = await client.send(
//         new CreateTableCommand({
//           TableName: table,
//           KeySchema: [{ AttributeName: "Projector", KeyType: "HASH" }],
//           AttributeDefinitions: [
//             { AttributeName: "Projector", AttributeType: "S" }
//           ],
//           ProvisionedThroughput: {
//             ReadCapacityUnits: 5,
//             WriteCapacityUnits: 5
//           }
//         })
//       );
//       log().info(`${name}.seed`, response);
//     },

//     drop: async (): Promise<void> => {
//       try {
//         await client.send(new DeleteTableCommand({ TableName: table }));
//       } catch {
//         //ignore when not found
//       }
//     },

//     load: async (ids) => {
//       /**
//        * Notes:
//        * - Needs Zod schema with "coerce" util
//        */
//       const response = await client.send(
//         new QueryCommand({
//           TableName: table,
//           KeyConditionExpression: "Projector = :Projector",
//           FilterExpression: "F_id IN (:F_ids)",
//           ExpressionAttributeValues: {
//             [":Projector"]: { S: "Projector" },
//             [":F_ids"]: { SS: ids }
//           }
//         })
//       );
//       return (
//         response.Items?.map((item) => ({
//           watermark: Number.parseInt(item.Watermark.N ?? "-1"),
//           state: schema.parse(
//             Object.fromEntries(
//               Object.entries(item).map(([k, v]) => [k.substring(2), v.S ?? v.N])
//             )
//           )
//         })) ?? []
//       );
//     },

//     commit: async (map, watermark) => {
//       const items: TransactWriteItem[] = [];

//       /**
//        * Notes:
//        * - Returned counters are not accurate on filtered operations
//        * - Cannot commit batches due to the lack of PK (ID)
//        */
//       let upserted = 0,
//         deleted = 0;

//       // filtered deletes
//       map.deletes.forEach((del) => {
//         deleted++;
//         const { ConditionExpression, ExpressionAttributeValues } = filter(del);
//         ExpressionAttributeValues[":Watermark"] = { N: watermark.toString() };
//         items.push({
//           Delete: {
//             TableName: table,
//             Key: { Projector: { S: "Projector" } },
//             ConditionExpression: ConditionExpression.concat(
//               " AND Watermark < :Watermark"
//             ),
//             ExpressionAttributeValues
//           }
//         });
//       });

//       // filtered updates
//       map.updates.forEach(({ where, ...patch }) => {
//         upserted++;
//         const {
//           ConditionExpression,
//           UpdateExpression,
//           ExpressionAttributeValues
//         } = filter(where, patch);
//         ExpressionAttributeValues[":Watermark"] = { N: watermark.toString() };
//         if (where) {
//           items.push({
//             Update: {
//               TableName: table,
//               Key: { Projector: { S: "Projector" } },
//               ConditionExpression: ConditionExpression.concat(
//                 " AND Watermark < :Watermark"
//               ),
//               UpdateExpression: UpdateExpression!.concat(
//                 ", Watermark = :Watermark"
//               ),
//               ExpressionAttributeValues
//             }
//           });
//         }
//       });

//       // patched records
//       map.records.forEach((rec, id) => {
//         // upserts when multiple keys are found in patch
//         if (Object.keys(rec).length) {
//           upserted++;
//           const ExpressionAttributeValues = Object.fromEntries<AttributeValue>(
//             Object.entries(rec).map(([k, v]) => [
//               `:F_${k}`,
//               { S: v.toString() }
//             ])
//           );
//           ExpressionAttributeValues[":F_id"] = { S: id };
//           ExpressionAttributeValues[":Watermark"] = { N: watermark.toString() };
//           items.push({
//             Update: {
//               TableName: table,
//               Key: { Projector: { S: "Projector" } },
//               UpdateExpression:
//                 "SET F_id = :F_id, Watermark = :Watermark, " +
//                 Object.keys(rec)
//                   .map((k) => `F_${k} = :F_${k}`)
//                   .join(", "),
//               ExpressionAttributeValues
//             }
//           });
//         } else {
//           deleted++;
//           items.push({
//             Delete: {
//               TableName: table,
//               Key: { Projector: { S: "Projector" } },
//               ConditionExpression: "F_id = :F_id",
//               ExpressionAttributeValues: { [":F_id"]: { S: id } }
//             }
//           });
//         }
//       });

//       try {
//         console.log(JSON.stringify(items, null, 2));
//         const tx = new TransactWriteItemsCommand({
//           TransactItems: items
//         });
//         await client.send(tx);
//         return Promise.resolve({ upserted, deleted, watermark });
//       } catch (error) {
//         console.log(JSON.stringify(items, null, 2), error);
//         log().error(error);
//       }
//       return Promise.resolve({ upserted: 0, deleted: 0, watermark });
//     },

//     query: (query) => {
//       // TODO await query results
//       console.log({ query });
//       throw Error("Not implemented");
//     },

//     agg: (query: AggQuery<S>) => {
//       // TODO await query results
//       console.log({ query });
//       throw Error("Not implemented");
//     }
//   };

//   log().info(`[${process.pid}] ✨ ${store.name}`);
//   dispose(() => {
//     if (store.dispose) {
//       log().info(`[${process.pid}] ♻️ ${store.name}`);
//       return store.dispose();
//     }
//     return Promise.resolve();
//   });

//   return store;
// };
