import Joi from "joi";
import { MessageFactory } from "@rotorsoft/eventually";
import { ... } from "./$.Model";

export type $Events = {
  EVENT: EVENTTYPE;
};

// Event handlers receive committed events with id and version - required
export const $EventsFactory: MessageFactory<$Events> = {
  EVENT: (data?: EVENTTYPE) => ({
    name: "EVENT",
    data: data,
    schema: () =>
      Joi.object({
        id: Joi.string().required(),
        version: Joi.number().required(),
        name: Joi.string().required().valid("EVENT"),
        data: Joi.string()
          .required()
          .valid(...EVENTTYPE),
      }),
  }),
};
