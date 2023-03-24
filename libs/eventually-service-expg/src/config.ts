import * as fs from "node:fs";
import z from "zod";
import { config as target, extend, Scope } from "@rotorsoft/eventually";

const Artifacts = z.object({
  eventually: z.object({
    store: z.string().min(1).optional(),
    artifacts: z.record(
      z.array(
        z.object({
          name: z.string().min(1),
          scope: z.nativeEnum(Scope).default(Scope.default)
        })
      )
    )
  })
});

type Config = z.infer<typeof Artifacts>;

const getArtifacts = (): Config => {
  const manifest = fs.readFileSync("package.json");
  return JSON.parse(manifest.toString()) as unknown as Config;
};

export const config = extend(getArtifacts(), Artifacts, target());
