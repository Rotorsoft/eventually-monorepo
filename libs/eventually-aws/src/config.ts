import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Regions = ["us-east-1", "us-east-2", "us-west-1", "us-west-2"] as const;
type Region = (typeof Regions)[number];

const Schema = z.object({
  aws: z.object({
    region: z.enum(Regions).optional(),
    dynamo: z
      .object({
        endpoint: z.string().optional()
      })
      .optional()
  })
});

const { AWS_REGION, AWS_DYNAMO_ENDPOINT } = process.env;

/**
 * AWS configuration options
 */
export const config = extend(
  {
    aws: {
      region: AWS_REGION as Region,
      dynamo: AWS_DYNAMO_ENDPOINT
        ? { endpoint: AWS_DYNAMO_ENDPOINT }
        : undefined
    }
  },
  Schema,
  target()
);
