import { Scopes, extend, config as target } from "@rotorsoft/eventually";
import * as fs from "node:fs";
import { z } from "zod";

const Artifacts = z.object({
  eventually: z.object({
    store: z.string().min(1).optional(),
    artifacts: z.record(
      z.array(
        z.object({
          name: z.string().min(1),
          scope: z.enum(Scopes).default("default")
        })
      )
    )
  })
});

type Config = z.infer<typeof Artifacts>;

const getArtifacts = (): Config => {
  const manifest = fs.readFileSync("package.json");
  return JSON.parse(manifest.toString());
};

export const config = extend(getArtifacts(), Artifacts, target());
