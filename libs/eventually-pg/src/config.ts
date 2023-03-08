import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Schema = z.object({
  pg: z.object({
    host: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
    database: z.string().min(1),
    port: z.number().int().min(1000).max(65535)
  })
});

const { PG_HOST, PG_USER, PG_PASSWORD, PG_DATABASE, PG_PORT } = process.env;

/**
 * Postgres configuration options
 */
export const config = extend(
  {
    pg: {
      host: PG_HOST,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      port: Number.parseInt(PG_PORT || "5432")
    }
  },
  Schema,
  target()
);
