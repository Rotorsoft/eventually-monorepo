import { extend, config as target } from "@rotorsoft/eventually";
import { z } from "zod";

const Regions = ["eastus", "centralus", "westus"] as const;
type Region = (typeof Regions)[number];

const Schema = z.object({
  azure: z.object({
    region: z.enum(Regions).optional()
  })
});

const { AZURE_REGION } = process.env;

/**
 * Azure configuration options
 */
export const config = extend(
  {
    azure: {
      region: AZURE_REGION as Region
    }
  },
  Schema,
  target()
);
