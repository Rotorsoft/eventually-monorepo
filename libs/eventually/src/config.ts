import * as dotenv from "dotenv";
import * as joi from "joi";
import { singleton } from "./singleton";
import * as fs from "fs";

dotenv.config();

type Package = {
  name: string;
  version: string;
};

const getPackage = (): Package => {
  const pkg = fs.readFileSync("package.json");
  return JSON.parse(pkg.toString()) as unknown as Package;
};

export enum Environments {
  development = "development",
  test = "test",
  staging = "staging",
  production = "production"
}

export enum LogLevels {
  error = "error",
  info = "info",
  trace = "trace"
}

export interface Config {
  env: Environments;
  host: string;
  port: number;
  logLevel: LogLevels;
  service: string;
  version: string;
}

export const extend = <S extends Record<string, any>, T extends Config>(
  source: S,
  schema: joi.ObjectSchema<S>,
  target?: T
): S & T => {
  const { error, value } = schema.validate(source, { abortEarly: false });
  if (error) throw Error(error.message);
  return Object.assign(target || {}, value) as S & T;
};

const { NODE_ENV, HOST, PORT, LOG_LEVEL } = process.env;

export const config = singleton(function config() {
  const pkg = getPackage();
  const parts = pkg.name.split("/");
  const service = parts[parts.length - 1];

  return extend(
    {
      env: (NODE_ENV as Environments) || Environments.development,
      host: HOST || "http://localhost",
      port: Number.parseInt(PORT || "3000"),
      logLevel: (LOG_LEVEL as unknown as LogLevels) || LogLevels.error,
      service,
      version: pkg.version
    },
    joi.object<Config>({
      env: joi
        .string()
        .required()
        .valid(...Object.keys(Environments)),
      host: joi.string().required().min(5),
      port: joi.number().port().required(),
      logLevel: joi
        .string()
        .required()
        .valid(...Object.keys(LogLevels)),
      service: joi.string().required(),
      version: joi.string().required()
    })
  );
});
