import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Regions = ["us-east1", "us-central1", "us-west1"] as const;
type Region = (typeof Regions)[number];

const Schema = z.object({
  gcp: z.object({
    region: z.enum(Regions).optional()
  })
});

const { GCP_REGION } = process.env;

/**
 * GCP configuration options
 */
export const config = extend(
  {
    gcp: {
      region: GCP_REGION as Region
    }
  },
  Schema,
  target()
);
