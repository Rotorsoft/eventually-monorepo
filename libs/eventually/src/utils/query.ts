import { ZodObject, ZodRawShape, z } from "zod";
import {
  Condition,
  Operators,
  type AggQuery,
  type Operator,
  type ProjectionQuery,
  type ProjectionSort,
  type ProjectionWhere,
  type RestAggQuery,
  type RestProjectionQuery,
  type State,
  Schema
} from "../types";
import { validate } from "./validation";

/**
 * Decodes projector filter conditions
 *
 * @param condition filter condition expressions
 * @returns [operator, value] tuples
 */
export const conditions = <T>(condition: Condition<T>): [Operator, any][] =>
  typeof condition === "object"
    ? (Object.entries(condition) as [Operator, any][])
    : [["eq", condition]];

/**
 * Converts ProjectionQuery to RestProjectionQuery
 */
export const toRestProjectionQuery = ({
  select,
  where,
  sort,
  limit
}: ProjectionQuery): RestProjectionQuery => ({
  select,
  where:
    where &&
    Object.entries(where).flatMap(([key, condition]) =>
      conditions(condition!).map(
        ([operator, value]) => `${key} ${operator} ${value}`
      )
    ),
  sort: sort && Object.entries(sort).map(([k, v]) => `${k} ${v}`),
  limit
});

/**
 * Converts RestProjectionQuery to ProjectionQuery, with schema validation
 */
export const toProjectionQuery = (
  { ids, select, where, sort, limit }: RestProjectionQuery,
  schema: Schema<State>
): string[] | ProjectionQuery => {
  if (ids && ids.length) return ids;
  const query = {
    select: select
      ? typeof select === "string"
        ? [select]
        : select
      : undefined,
    where: where
      ? parseWhere(typeof where === "string" ? [where] : where)
      : undefined,
    sort: sort
      ? parseSort(typeof sort === "string" ? [sort] : sort)
      : undefined,
    limit: limit ? +limit : undefined
  };
  const keys = (schema as ZodObject<ZodRawShape>).keyof();
  validate<ProjectionQuery>(
    query,
    z.object({
      select: z.array(keys).optional(),
      where: z.record(keys, z.record(z.enum(Operators), z.string())).optional(),
      sort: z.record(keys, z.enum(["asc", "desc"])).optional(),
      limit: z.number().int().optional()
    })
  );
  return query;
};

/**
 * Converts projection query to query string
 */
export const toProjectionQueryString = (query: ProjectionQuery): string => {
  const { ids, select, where, sort, limit } = toRestProjectionQuery(query);
  const querystring = new URLSearchParams();
  ids && ids.forEach((v) => querystring.append("id", v));
  select && select.forEach((v) => querystring.append("select", v));
  where && where.forEach((v) => querystring.append("where", v));
  sort && sort.forEach((v) => querystring.append("sort", v));
  limit && querystring.append("limit", limit.toString());
  return querystring.toString();
};

/**
 * Converts AggQuery to RestAggQuery
 */
export const toRestAggQuery = <S extends State>({
  select,
  where
}: AggQuery<S>): RestAggQuery => ({
  select: Object.entries(select).map(([k, v]) => `${k} ${v}`),
  where:
    where &&
    Object.entries(where).flatMap(([key, condition]) =>
      conditions(condition as Condition<any>).map(
        ([operator, value]) => `${key} ${operator} ${value}`
      )
    )
});

const parseWhere = (filters: string[]): ProjectionWhere =>
  filters.reduce((result, v) => {
    try {
      const [field, operator, value] = v.split(" ").filter(Boolean);
      if (Operators.includes(operator as Operator))
        return Object.assign(result, {
          [field]: { [operator]: value }
        });
      else throw Error(`Invalid where clause: ${v}`);
    } catch {
      throw Error(`Invalid where clause: ${v}`);
    }
  }, {} as ProjectionWhere);

const parseSort = (sorts: string[]): ProjectionSort =>
  sorts.reduce((result, v) => {
    try {
      const [field, order] = v.split(" ").filter(Boolean);
      if (order === "asc" || order === "desc")
        return Object.assign(result, { [field]: order });
      else throw Error(`Invalid sort clause: ${v}`);
    } catch {
      throw Error(`Invalid sort clause: ${v}`);
    }
  }, {} as ProjectionSort);
