import { extend, config as target } from "@rotorsoft/eventually";
import { z } from "zod";

const Regions = ["us-east1", "us-central1", "us-west1"] as const;
type Region = (typeof Regions)[number];

const Schema = z.object({
  gcp: z.object({
    projectId: z.string().optional(),
    keyFilename: z.string().optional(),
    region: z.enum(Regions).optional(),
    firestore: z
      .object({
        host: z.string().optional(),
        port: z.number().optional()
      })
      .optional()
  })
});

const {
  GCP_REGION,
  GCP_PROJECT_ID,
  GCP_KEY_FILENAME,
  GCP_FIRESTORE_HOST,
  GCP_FIRESTORE_PORT
} = process.env;

/**
 * GCP configuration options
 */
export const config = extend(
  {
    gcp: {
      projectId: GCP_PROJECT_ID,
      firestore:
        GCP_FIRESTORE_HOST || GCP_FIRESTORE_PORT
          ? {
              host: GCP_FIRESTORE_HOST,
              port: Number.parseInt(GCP_FIRESTORE_PORT || "8080")
            }
          : undefined,
      keyFilename: GCP_KEY_FILENAME!,
      region: GCP_REGION as Region
    }
  },
  Schema,
  target()
);
