import joi from "joi";
import { ZodType } from "zod";
import { CommandHandlerFactory, EventHandlerFactory } from "./command-side";
import { Messages, Payload } from "./messages";

/**
 * Generic schema union supporting both `joi` and `zod` validations
 */
export type Schema<T extends Payload> = joi.ObjectSchema<T> | ZodType<T>;

export type Schemas<T extends Messages> = {
  [Key in keyof T & string]: Schema<T[Key] & Payload>;
};

export type MessageMetadata<T extends Messages = any> = {
  name: keyof T;
  schema?: Schema<T[keyof T] & Payload>;
  commandHandlerFactory?: CommandHandlerFactory<Payload, any, any>;
  eventHandlerFactories: Record<string, EventHandlerFactory<Payload, any, any>>;
};

export type WithSchemas<C extends Messages, E extends Messages> = {
  schemas?: {
    [Key in keyof (C & E)]?: Schema<(C & E)[Key] & Payload>;
  };
};
