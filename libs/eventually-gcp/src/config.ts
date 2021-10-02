import * as joi from "joi";
import { Config, config as target, extend } from "@rotorsoft/eventually";

interface GcpConfig {
  gcp: {
    project?: string;
  };
}

const { GCP_PROJECT } = process.env;

export const config: Config & GcpConfig = extend(
  {
    gcp: { project: GCP_PROJECT }
  },
  joi.object<GcpConfig>({
    gcp: joi.object({
      project: joi.string().optional()
    })
  }),
  target()
);
