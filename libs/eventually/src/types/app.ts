import joi from "joi";
import { SnapshotStore } from "../interfaces";
import {
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  ReducibleFactory,
  Snapshot
} from "./command-side";
import { Payload } from "./messages";

export type Package = {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
  };
  license: string;
  dependencies: Record<string, string>;
};

export type Factories = {
  commandHandlers: {
    [name: string]: CommandHandlerFactory<Payload, unknown, unknown>;
  };
  eventHandlers: {
    [name: string]: EventHandlerFactory<Payload, unknown, unknown>;
  };
  commandAdapters: {
    [name: string]: CommandAdapterFactory<Payload, Payload>;
  };
};

export type Endpoints = {
  version: string;
  commandHandlers: {
    [name: string]: {
      type: "aggregate" | "external-system";
      factory: CommandHandlerFactory<Payload, unknown, unknown>;
      commands: Record<string, string>;
      events: string[];
    };
  };
  eventHandlers: {
    [name: string]: {
      type: "policy" | "process-manager";
      factory: EventHandlerFactory<Payload, unknown, unknown>;
      path: string;
      events: string[];
    };
  };
  schemas: {
    [name: string]: joi.Description;
  };
};

export type MessageMetadata = {
  name: string;
  schema?: joi.ObjectSchema<Payload>;
  commandHandlerFactory?: CommandHandlerFactory<Payload, unknown, unknown>;
  eventHandlerFactories: Record<
    string,
    EventHandlerFactory<Payload, unknown, unknown>
  >;
};

export type Schemas<M> = {
  [Key in keyof M & string]: joi.ObjectSchema<M[Key] & Payload>;
};

export type SnapshotOptions = {
  store: SnapshotStore;
  threshold?: number;
  expose?: boolean;
};

/**
 * Apps are getters of reducibles
 */
export type Getter = <M extends Payload, C, E>(
  factory: ReducibleFactory<M, C, E>,
  id: string,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<M>) => void
) => Promise<Snapshot<M> | Snapshot<M>[]>;
