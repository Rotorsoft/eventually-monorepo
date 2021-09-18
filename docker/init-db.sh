#!/bin/sh

echo "creating user"
psql postgres -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres'"

echo "creating db"
psql postgres -U postgres << EOF
CREATE DATABASE postgres;

CREATE TABLE IF NOT EXISTS public.events
(
    id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    version bigint NOT NULL,
    name character varying(100) COLLATE pg_catalog."default",
    data json",
    "timestamp" timestamp without time zone DEFAULT Now(),
    CONSTRAINT events_pkey PRIMARY KEY (id, version)
)
TABLESPACE pg_default;

ALTER TABLE public.events
    OWNER to postgres;
EOF

exit 0
