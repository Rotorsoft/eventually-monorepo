import z from "zod";
import { config as target, extend } from "@rotorsoft/eventually";

const Schema = z.object({
  port: z.number().int().min(1000).max(65535)
});

const { PORT } = process.env;

export const config = extend(
  {
    port: Number.parseInt(PORT || "3000")
  },
  Schema,
  target()
);
