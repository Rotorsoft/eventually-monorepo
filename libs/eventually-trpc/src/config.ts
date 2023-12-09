import { extend, config as target } from "@rotorsoft/eventually";
import * as fs from "node:fs";
import { z } from "zod";

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
  return JSON.parse(pkg.toString()) as Package;
};

/**
 * Configuration zod schema
 */
const Schema = z.object({
  service: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  author: z.object({ name: z.string().min(1), email: z.string() }),
  license: z.string().min(1),
  dependencies: z.record(z.string()),
  port: z.number().int().min(1000).max(65535)
});
export type Config = z.infer<typeof Schema>;

const { PORT } = process.env;
const pkg = getPackage();
const parts = pkg.name.split("/");
const service = parts.at(-1) || "";

export const config = extend(
  {
    service,
    version: pkg.version,
    description: pkg.description,
    author: { name: pkg.author?.name, email: pkg.author?.email },
    license: pkg.license,
    dependencies: pkg.dependencies,
    port: parseInt(PORT || "3000") || 3000
  },
  Schema,
  target()
);
