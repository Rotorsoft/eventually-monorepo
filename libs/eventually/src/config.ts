import * as dotenv from "dotenv";
import * as joi from "joi";
import { singleton } from "./singleton";
import * as fs from "fs";
import { Config, Environments, LogLevels } from "./interfaces";

dotenv.config();

type Package = {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
  };
  license: string;
  dependencies: Record<string, string>;
};

const getPackage = (): Package => {
  const pkg = fs.readFileSync("package.json");
  return JSON.parse(pkg.toString()) as unknown as Package;
};

export const extend = <S extends Record<string, any>, T extends Config>(
  source: S,
  schema: joi.ObjectSchema<S>,
  target?: T
): S & T => {
  const { error, value } = schema.validate(source, {
    abortEarly: false,
    allowUnknown: true
  });
  if (error) throw Error(error.message);
  return Object.assign(target || {}, value) as S & T;
};

const { NODE_ENV, HOST, PORT, LOG_LEVEL } = process.env;

export const config = singleton(function config() {
  const pkg = getPackage();
  const parts = pkg.name.split("/");
  const service = parts.at(-1);

  return extend(
    {
      name: "config",
      dispose: (): Promise<void> => Promise.resolve(),
      env: (NODE_ENV as Environments) || Environments.development,
      host: HOST || "http://localhost",
      port: Number.parseInt(PORT || "3000"),
      logLevel: (LOG_LEVEL as unknown as LogLevels) || LogLevels.error,
      service,
      version: pkg.version,
      description: pkg.description,
      author: `${pkg.author?.name} (${pkg.author?.email})`,
      license: pkg.license,
      dependencies: pkg.dependencies
    },
    joi
      .object<Config>({
        env: joi.string().valid(...Object.keys(Environments)),
        host: joi.string().min(5),
        port: joi.number().port(),
        logLevel: joi.string().valid(...Object.keys(LogLevels)),
        service: joi.string(),
        version: joi.string(),
        description: joi.string(),
        author: joi.string(),
        license: joi.string(),
        dependencies: joi.object({})
      })
      .options({ presence: "required" })
  );
});
