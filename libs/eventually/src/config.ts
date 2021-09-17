import * as joi from "joi";
import * as dotenv from "dotenv";

dotenv.config();

export enum Environments {
  development = "development",
  test = "test",
  staging = "staging",
  production = "production"
}

export interface Config {
  env: Environments;
  host: string;
  port: number;
}

export const extend = <S extends Record<string, any>, T extends Config>(
  source: S,
  schema: joi.ObjectSchema<S>,
  target?: T
): S & T => {
  const { error, value } = schema.validate(source);
  if (error) throw Error(error.message);
  return Object.assign(target || {}, value) as S & T;
};

const { NODE_ENV, HOST, PORT } = process.env;

export const config: Config = extend(
  {
    env: (NODE_ENV as Environments) || Environments.development,
    host: HOST || "http://localhost",
    port: Number.parseInt(PORT || "3000")
  },
  joi.object<Config>({
    env: joi
      .string()
      .required()
      .valid(...Object.keys(Environments)),
    host: joi.string().required().min(5),
    port: joi.number().integer().required().min(3000).max(9000)
  })
);
