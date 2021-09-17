import * as joi from "joi";
import { Config, config as target, extend } from "@rotorsoft/eventually";

interface GcpConfig {
  gcp: {
    project: string;
    keyfilename?: string;
  };
}

const { GCP_PROJECT, GCP_KEYFILENAME } = process.env;

export const config: Config & GcpConfig = extend(
  {
    gcp: {
      project: GCP_PROJECT,
      keyfilename: GCP_KEYFILENAME
    }
  },
  joi.object<GcpConfig>({
    gcp: joi.object({
      project: joi.string().required().min(4),
      keyfilename: joi.string().optional().min(5)
    })
  }),
  target
);
