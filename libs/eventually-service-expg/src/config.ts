import * as fs from "node:fs";
import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Artifact = z.object({
  package: z.string().min(10),
  description: z.string().min(1)
});

const Artifacts = z.object({
  eventually: z.object({
    store: z.string().min(1).optional(),
    aggregates: z
      .record(
        z.intersection(
          Artifact,
          z.object({
            snapshot: z
              .object({
                name: z.string().min(1),
                threshold: z.number().int(),
                expose: z.boolean().optional()
              })
              .optional()
          })
        )
      )
      .optional(),
    policies: z.record(Artifact).optional(),
    adapters: z.record(Artifact).optional(),
    ["external-systems"]: z.record(Artifact).optional(),
    ["process-managers"]: z.record(Artifact).optional()
  })
});

type Config = z.infer<typeof Artifacts>;

const getArtifacts = (): Config => {
  const manifest = fs.readFileSync("package.json");
  return JSON.parse(manifest.toString()) as unknown as Config;
};

export const config = extend(getArtifacts(), Artifacts, target());
