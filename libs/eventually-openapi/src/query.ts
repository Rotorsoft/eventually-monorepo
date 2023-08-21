import {
  Operators,
  conditions,
  validate,
  type AggQuery,
  type Operator,
  type ProjectionQuery,
  type ProjectionSort,
  type ProjectionWhere,
  type State,
  Condition
} from "@rotorsoft/eventually";
import { ZodObject, z } from "zod";

/**
 * REST projection query options
 */
export type RestProjectionQuery = {
  ids?: string[];
  select?: string[];
  where?: string[];
  sort?: string[];
  limit?: number;
};

/**
 * Converts a projection query to a REST query
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
 * REST aggregate query options
 */
export type RestAggQuery = {
  select?: string[];
  where?: string[];
};

/**
 * Converts an aggregate query to a REST query
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

/**
 * Converts a REST projection query with zod object schema to a projection query
 */
export const toProjectionQuery = (
  { ids, select, where, sort, limit }: RestProjectionQuery,
  schema: ZodObject<State>
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
  const keys = schema.keyof();
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
