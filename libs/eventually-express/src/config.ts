import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

export enum OAS_UIS {
  SwaggerUI = "SwaggerUI",
  Rapidoc = "Rapidoc",
  Redoc = "Redoc"
}

const Schema = z.object({
  port: z.number().int().min(1000).max(65535),
  oas_ui: z.nativeEnum(OAS_UIS)
});

const { PORT, OAS_UI } = process.env;

export const config = extend(
  {
    port: Number.parseInt(PORT || "3000"),
    oas_ui: OAS_UI || OAS_UIS.SwaggerUI
  },
  Schema,
  target()
);
