import { ProjectionState } from "@rotorsoft/eventually";

export const stream = (table: string): string => `
CREATE TABLE IF NOT EXISTS public.${table}
(
	id serial PRIMARY KEY,
  name character varying(100) COLLATE pg_catalog."default" NOT NULL,
  data json,
  stream character varying(100) COLLATE pg_catalog."default" NOT NULL,
  version int NOT NULL,
  created timestamptz NOT NULL DEFAULT now(),
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
		alter table public.${table}
		alter created type timestamptz using created at time zone 'UTC',
		alter created set not null,
		alter created set default now();
	END IF;
END
$$;

ALTER TABLE public.${table}
ADD COLUMN IF NOT EXISTS metadata json;

CREATE UNIQUE INDEX IF NOT EXISTS ${table}_stream_ix
  ON public.${table} USING btree
  (stream COLLATE pg_catalog."default" ASC, version ASC)
  TABLESPACE pg_default;
	
CREATE INDEX IF NOT EXISTS ${table}_name_ix
  ON public.${table} USING btree
  (name COLLATE pg_catalog."default" ASC)
  TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS ${table}_created_id_ix
  ON public.${table} USING btree
  (created ASC, id ASC)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS ${table}_correlation_ix
  ON public.${table} USING btree
  ((metadata ->> 'correlation'::text) COLLATE pg_catalog."default" ASC NULLS LAST)
  TABLESPACE pg_default;
    
DROP INDEX IF EXISTS stream_ix;
DROP INDEX IF EXISTS name_id;
DROP INDEX IF EXISTS created_id_ix;

CREATE TABLE IF NOT EXISTS public.${table}_watermarks
(
	name varchar(100) PRIMARY KEY,
  watermark bigint NOT NULL
) TABLESPACE pg_default;
`;

export const snapshot = (table: string): string => `
CREATE TABLE IF NOT EXISTS public.${table}
(
  stream varchar(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY,
  data json
) TABLESPACE pg_default;`;

// TODO: infer pg schema types from projection state (zod?)
export type ProjectionSchema<S extends ProjectionState> = {
  [K in keyof S]: string;
};
export const projector = <S extends ProjectionState>(
  table: string,
  schema: ProjectionSchema<S>,
  indexes: string
): string => {
  const fields = Object.entries(schema).map(
    ([field, type]) => `"${field}" ${type}`
  );
  return `
  CREATE TABLE IF NOT EXISTS public.${table}(
    ${fields.join(",\n\t")},
    __watermark bigint NOT NULL) TABLESPACE pg_default;

  ${indexes}`;
};
