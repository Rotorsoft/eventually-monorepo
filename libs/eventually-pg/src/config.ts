import * as joi from "joi";
import { Config, config as target, extend } from "@rotorsoft/eventually";

interface PgConfig {
  pg: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
}

const { PG_HOST, PG_USER, PG_PASSWORD, PG_DATABASE, PG_PORT } = process.env;

export const config: Config & PgConfig = extend(
  {
    pg: {
      host: PG_HOST,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      port: Number.parseInt(PG_PORT || "5432")
    }
  },
  joi.object<PgConfig>({
    pg: joi.object({
      host: joi.string().required(),
      user: joi.string().required(),
      password: joi.string().required(),
      database: joi.string().required(),
      port: joi.number().port().required()
    })
  }),
  target
);
