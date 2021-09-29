const { Client } = require("pg");

const pgclient = new Client({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: "postgres",
  password: "postgres",
  database: "postgres"
});

pgclient.connect();

pgclient.query(
  `
CREATE TABLE IF NOT EXISTS public.events
(
	event_id serial PRIMARY KEY,
    event_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    event_data json,
    aggregate_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    aggregate_version int NOT NULL,
    created_at timestamp without time zone DEFAULT now()
) TABLESPACE pg_default;
ALTER TABLE public.events OWNER to postgres;

CREATE UNIQUE INDEX aggregate_ix
    ON public.events USING btree
    (aggregate_id COLLATE pg_catalog."default" ASC, aggregate_version ASC)
    TABLESPACE pg_default;
	
CREATE INDEX topic_ix
    ON public.events USING btree
    (event_name COLLATE pg_catalog."default" ASC)
    TABLESPACE pg_default;`,
  (err) => {
    if (err) throw err;
  }
);
