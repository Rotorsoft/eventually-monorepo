import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Regions = ["us-east-1", "us-east-2", "us-west-1", "us-west-2"] as const;
type Region = (typeof Regions)[number];

const Schema = z.object({
  aws: z.object({
    region: z.enum(Regions).optional(),
    credentials: z
      .object({
        accessKeyId: z.string(),
        secretAccessKey: z.string()
      })
      .optional(),
    dynamo: z
      .object({
        endpoint: z.string().optional()
      })
      .optional()
  })
});

const {
  AWS_REGION,
  AWS_DYNAMO_ENDPOINT,
  AWS_CREDENTIALS_ACCESS_KEY_ID,
  AWS_CREDENTIALS_SECRET_ACCESS_KEY
} = process.env;

/**
 * AWS configuration options
 */
export const config = extend(
  {
    aws: {
      region: AWS_REGION as Region,
      credentials: AWS_CREDENTIALS_ACCESS_KEY_ID
        ? {
            accessKeyId: AWS_CREDENTIALS_ACCESS_KEY_ID,
            secretAccessKey:
              AWS_CREDENTIALS_SECRET_ACCESS_KEY ?? "missing-secret"
          }
        : undefined,
      dynamo: AWS_DYNAMO_ENDPOINT
        ? { endpoint: AWS_DYNAMO_ENDPOINT }
        : undefined
    }
  },
  Schema,
  target()
);
