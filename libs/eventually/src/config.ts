import * as dotenv from "dotenv";
import * as fs from "fs";
import z from "zod";
import { extend } from "./schema";
import { singleton } from "./singleton";
import { Package } from "./types/app";
import { Environments, LogLevels } from "./types/enums";

dotenv.config();

const getPackage = (): Package => {
  const pkg = fs.readFileSync("package.json");
  return JSON.parse(pkg.toString()) as unknown as Package;
};

const Schema = z.object({
  name: z.string().min(1),
  env: z.nativeEnum(Environments),
  host: z.string().min(5),
  port: z.number().int().min(1000).max(65535),
  logLevel: z.nativeEnum(LogLevels),
  service: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  license: z.string().min(1),
  dependencies: z.object({})
});
export type Config = z.infer<typeof Schema>;

const { NODE_ENV, HOST, PORT, LOG_LEVEL } = process.env;

export const config = singleton(function config() {
  const pkg = getPackage();
  const parts = pkg.name.split("/");
  const service = parts.at(-1) || "";
  return {
    ...extend(
      {
        name: "config",
        env: (NODE_ENV as Environments) || Environments.development,
        host: HOST || "http://localhost",
        port: Number.parseInt(PORT || "3000"),
        logLevel: (LOG_LEVEL as LogLevels) || LogLevels.error,
        service,
        version: pkg.version,
        description: pkg.description,
        author: `${pkg.author?.name} (${pkg.author?.email})`,
        license: pkg.license,
        dependencies: pkg.dependencies
      },
      Schema
    ),
    dispose: (): Promise<void> => Promise.resolve()
  };
});
