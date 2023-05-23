import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

/**
 * OpenAPI spec options
 * @default SwaggerUI
 */
const OAS_UIS = ["SwaggerUI", "Rapidoc", "Redoc"] as const;
export type OAS_UI = (typeof OAS_UIS)[number];

/**
 * Configuration zod schema
 */
const Schema = z.object({
  port: z.number().int().min(1000).max(65535),
  oas_ui: z.enum(OAS_UIS)
});

const { PORT, OAS_UI } = process.env;

/**
 * Express configuration options
 */
export const config = extend(
  {
    port: parseInt(PORT || "3000") || 3000,
    oas_ui: (OAS_UI as OAS_UI) || "SwaggerUI"
  },
  Schema,
  target()
);
