import { bind, CommandAdapterFactory } from "@rotorsoft/eventually";
import z from "zod";
import * as schemas from "./calculator.schemas";

export const ExternalPayloadSchema = z.object({
  id: z.string().min(1),
  key: z.enum([...schemas.DIGITS, ...schemas.OPERATORS, ...schemas.SYMBOLS])
});

export type ExternalPayload = z.infer<typeof ExternalPayloadSchema>;

export const PressKeyAdapter: CommandAdapterFactory<
  ExternalPayload,
  schemas.CalculatorCommands
> = () => ({
  description: "PressKey adapter",
  schemas: {
    message: ExternalPayloadSchema,
    commands: { PressKey: "when a key received", Reset: "never invoked" }
  },
  on: ({ id, key }) => bind("PressKey", { key }, { id })
});
