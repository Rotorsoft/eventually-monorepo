import { AxiosResponse } from "axios";
import * as joi from "joi";

export type Message<Name, Type> = {
  readonly name: Name;
  readonly data?: Type;
  schema: () => joi.ObjectSchema<Message<Name, Type>>;
};

export interface CommittedEvent<Name, Type> {
  readonly id: string;
  readonly version: string;
  readonly name: Name;
  readonly data?: Type;
}

export type MessageFactory<Messages> = {
  [Name in keyof Messages]: (
    data?: Messages[Name]
  ) => Message<string & Name, Messages[Name]>;
};

export type CommandHandler<Model, Commands, Events> = {
  [Name in keyof Commands as `on${Capitalize<string & Name>}`]: (
    state: Readonly<Model>,
    data?: Commands[Name]
  ) => Promise<Message<string & keyof Events, any>>;
};

export type PolicyResponse<Commands> = {
  id: string;
  expectedVersion?: string;
  command: Message<string & keyof Commands, any>;
};

export type EventHandler<Response, Events> = {
  [Name in keyof Events as `on${Capitalize<string & Name>}`]: (
    event: CommittedEvent<string & Name, Events[Name]>
  ) => Promise<Response>;
};

export type ModelReducer<Model, Events> = {
  readonly id: string;
  name: () => string;
  init: () => Readonly<Model>;
} & {
  [Name in keyof Events as `apply${Capitalize<string & Name>}`]: (
    state: Readonly<Model>,
    event: CommittedEvent<string & Name, Events[Name]>
  ) => Readonly<Model>;
};

export type Aggregate<Model, Commands, Events> = ModelReducer<Model, Events> &
  CommandHandler<Model, Commands, Events>;

export type Policy<Commands, Events> = { name: () => string } & EventHandler<
  PolicyResponse<Commands> | undefined,
  Events
>;

export type Projector<Events> = { name: () => string } & EventHandler<
  void,
  Events
>;

export interface Bus {
  /**
   * Subscribes an event handler to an event
   * @param event The event and service path to be subscribed
   */
  subscribe: (
    event: CommittedEvent<string, any>,
    factory: () => { name: () => string } & EventHandler<any, any>,
    path: string
  ) => Promise<void>;

  /**
   * Emits events to subscribed services
   * @param event A committed event to be emitted
   */
  emit(event: CommittedEvent<string, any>): Promise<void>;

  /**
   * Request body adapter
   * @param body The body in a POST request
   */
  body(body: any): any;

  /**
   * Sends a command to a routed service
   * @param command The command instance
   */
  send(
    command: Message<string, any>,
    factory: (id: string) => CommandHandler<any, any, any>,
    path: string,
    id: string,
    expectedVersion?: string
  ): Promise<AxiosResponse | [any, CommittedEvent<string, any>]>;
}

export interface Store {
  load: (
    id: string,
    reducer: (event: CommittedEvent<string, any>) => void
  ) => Promise<void>;
  commit: (
    id: string,
    event: Message<string, any>,
    expectedVersion?: string
  ) => Promise<CommittedEvent<string, any>>;
}
