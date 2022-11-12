import joi from "joi";
import { CommandHandlerFactory, EventHandlerFactory } from "./command-side";
import { Messages, Payload } from "./messages";

export type Schema<T extends Payload> = joi.ObjectSchema<T>;

export type Schemas<T extends Messages> = {
  [Key in keyof T & string]: Schema<T[Key]>;
};

export type MessageMetadata<T extends Messages = any> = {
  name: keyof T;
  schema?: Schema<T[keyof T]>;
  commandHandlerFactory?: CommandHandlerFactory<Payload, any, any>;
  eventHandlerFactories: Record<string, EventHandlerFactory<Payload, any, any>>;
};

export type WithSchemas<C extends Messages, E extends Messages> = {
  schemas?: {
    [Key in keyof (C & E)]?: Schema<(C & E)[Key]>;
  };
};
