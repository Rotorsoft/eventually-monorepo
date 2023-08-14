import type {
  Projection,
  ProjectionSort,
  Schema,
  State
} from "@rotorsoft/eventually";
import { z } from "zod";

export const stream = (table: string): string => `
CREATE TABLE IF NOT EXISTS public."${table}"
(
	id serial PRIMARY KEY,
  name varchar(100) COLLATE pg_catalog."default" NOT NULL,
  data json,
  stream varchar(100) COLLATE pg_catalog."default" NOT NULL,
  version int NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
  actor varchar(100) COLLATE pg_catalog."default",
  metadata json
) TABLESPACE pg_default;

DO $$
BEGIN
  IF EXISTS(
		select * from information_schema.columns 
		where table_schema = 'public'
		and table_name = '${table}'
		and column_name = 'created'
		and data_type = 'timestamp without time zone'
	) THEN
		alter table public."${table}"
		alter created type timestamptz using created at time zone 'UTC',
		alter created set not null,
		alter created set default now();
	END IF;
END
$$;

ALTER TABLE public."${table}"
ADD COLUMN IF NOT EXISTS actor varchar(100) COLLATE pg_catalog."default";

ALTER TABLE public."${table}"
ADD COLUMN IF NOT EXISTS metadata json;

CREATE UNIQUE INDEX IF NOT EXISTS "${table}_stream_ix"
  ON public."${table}" USING btree (stream COLLATE pg_catalog."default" ASC, version ASC)
  TABLESPACE pg_default;
	
CREATE INDEX IF NOT EXISTS "${table}_name_ix"
  ON public."${table}" USING btree (name COLLATE pg_catalog."default" ASC)
  TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS "${table}_created_id_ix"
  ON public."${table}" USING btree (created ASC, id ASC)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "${table}_actor_ix"
  ON public."${table}" USING btree (actor COLLATE pg_catalog."default" ASC NULLS LAST)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "${table}_correlation_ix"
  ON public."${table}" USING btree ((metadata ->> 'correlation'::text) COLLATE pg_catalog."default" ASC NULLS LAST)
  TABLESPACE pg_default;
    
DROP INDEX IF EXISTS stream_ix;
DROP INDEX IF EXISTS name_id;
DROP INDEX IF EXISTS created_id_ix;

CREATE TABLE IF NOT EXISTS public."${table}_subscriptions"
(
	consumer varchar(100) PRIMARY KEY,
  watermark bigint NOT NULL,
  lease varchar(100),
  expires timestamptz
) TABLESPACE pg_default;
`;

const ZOD2PG: { [K in z.ZodFirstPartyTypeKind]?: string } = {
  [z.ZodFirstPartyTypeKind.ZodString]: "TEXT",
  [z.ZodFirstPartyTypeKind.ZodNumber]: "NUMERIC",
  [z.ZodFirstPartyTypeKind.ZodBoolean]: "BOOLEAN",
  [z.ZodFirstPartyTypeKind.ZodDate]: "TIMESTAMPTZ",
  [z.ZodFirstPartyTypeKind.ZodBigInt]: "BIGINT",
  [z.ZodFirstPartyTypeKind.ZodObject]: "JSON"
};

const toCol = (name: string, type: any, optional = false): string => {
  if (
    type instanceof z.ZodString ||
    type instanceof z.ZodNumber ||
    type instanceof z.ZodBoolean ||
    type instanceof z.ZodDate ||
    type instanceof z.ZodBigInt ||
    type instanceof z.ZodObject ||
    type instanceof z.ZodOptional
  ) {
    if (name === "id") return "";
    if (type instanceof z.ZodOptional)
      return toCol(name, type._def.innerType, true);
    const pgtype = ZOD2PG[type._def.typeName];
    const nullable =
      optional || type.isOptional() || type.isNullable() ? "" : " NOT NULL";
    return `"${name}" ${pgtype}${nullable}`;
  }
  throw Error(`Zod->PG seed type of ${name} not supported!`);
};

export const projector = <S extends State>(
  table: string,
  schema: Schema<Projection<S>>,
  indexes: ProjectionSort<S>[]
): string => {
  const cols = Object.entries((schema as unknown as z.ZodObject<S>).shape).map(
    ([key, type]) => toCol(key, type)
  );
  return `CREATE TABLE IF NOT EXISTS public."${table}"(
  id TEXT NOT NULL PRIMARY KEY,
  ${cols.filter(Boolean).join(",\n  ")},
  __watermark BIGINT NOT NULL
) TABLESPACE pg_default;

  ${indexes
    .map(
      (index) =>
        `CREATE INDEX IF NOT EXISTS "${table}_${Object.keys(index).join(
          "_"
        )}_ix" ON public."${table}" USING btree (${Object.entries(index)
          .map(([key, order]) => `"${key}" ${order}`)
          .join(",")}) TABLESPACE pg_default;`
    )
    .join("\n")}`;
};
