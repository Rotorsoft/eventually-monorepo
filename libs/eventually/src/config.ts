import * as dotenv from "dotenv";
import { z } from "zod";
import { Environment, Environments, LogLevel, LogLevels } from "./types/enums";
import { extend } from "./utils";

dotenv.config();

const Schema = z.object({
  env: z.enum(Environments),
  logLevel: z.enum(LogLevels)
});
export type Config = z.infer<typeof Schema>;

const { NODE_ENV, LOG_LEVEL } = process.env;

export const config = (): Config => {
  return extend(
    {
      env: (NODE_ENV as Environment) || "development",
      logLevel: (LOG_LEVEL as LogLevel) || "error"
    },
    Schema
  );
};
