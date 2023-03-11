import {
  Condition,
  Operator,
  ProjectionQuery,
  ProjectionSort,
  ProjectionWhere,
  State,
  validate
} from "@rotorsoft/eventually";
import { z, ZodObject } from "zod";

/**
 * Projection query options
 */
export type ExpressProjectionQuery = {
  ids?: string[];
  select?: string[];
  where?: string[];
  sort?: string[];
  limit?: number;
};

const OPS = Object.fromEntries(Object.entries(Operator));

const parseWhere = (filters: string[]): ProjectionWhere =>
  filters.reduce((result, v) => {
    try {
      const [field, operator, value] = v.split(" ").filter(Boolean);
      if (OPS[operator])
        return Object.assign(result, {
          [field]: {
            operator: OPS[operator],
            value
          } as Condition<any>
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

export const toProjectionQuery = (
  { ids, select, where, sort, limit }: ExpressProjectionQuery,
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
      where: z
        .record(
          keys,
          z.object({ operator: z.nativeEnum(Operator), value: z.string() })
        )
        .optional(),
      sort: z.record(keys, z.enum(["asc", "desc"])).optional(),
      limit: z.number().int().optional()
    })
  );
  return query;
};

export const toExpressProjectionQuery = ({
  select,
  where,
  sort,
  limit
}: ProjectionQuery): ExpressProjectionQuery => {
  return {
    select,
    where:
      where &&
      Object.entries(where).map(([k, v]) => `${k} ${v?.operator} ${v?.value}`),
    sort: sort && Object.entries(sort).map(([k, v]) => `${k} ${v}`),
    limit
  };
};
