import Joi from "joi";
import { MessageFactory } from "@rotorsoft/eventually";
import { ... } from "./$.Model";

export type $Commands = {
  COMMAND: COMMANDTYPE;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const $CommandsFactory: MessageFactory<$Commands> = {
  COMMAND: (data?: COMMANDTYPE) => ({
    name: "COMMAND",
    data: data,
    schema: () =>
      Joi.object({
        id: Joi.string().optional(),
        name: Joi.string().required().valid("COMMAND"),
        data: Joi.string()
          .required()
          ...
          .valid(...COMMANDTYPE),
      }),
  }),
};
