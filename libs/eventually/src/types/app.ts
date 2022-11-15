import { SnapshotStore } from "../interfaces";
import {
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory
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
    [name: string]: CommandHandlerFactory<Payload, any, any>;
  };
  eventHandlers: {
    [name: string]: EventHandlerFactory<Payload, any, any>;
  };
  commandAdapters: {
    [name: string]: CommandAdapterFactory<Payload, any>;
  };
};

export type CommandHandlerType = "aggregate" | "external-system";
export type EventHandlerType = "policy" | "process-manager";

export type Endpoints = {
  version: string;
  commandHandlers: {
    [name: string]: {
      type: CommandHandlerType;
      factory: CommandHandlerFactory<Payload, any, any>;
      commands: Record<string, string>;
      events: string[];
    };
  };
  eventHandlers: {
    [name: string]: {
      type: EventHandlerType;
      factory: EventHandlerFactory<Payload, any, any>;
      path: string;
      events: string[];
    };
  };
};

export type SnapshotOptions = {
  store: SnapshotStore;
  threshold: number;
  expose?: boolean;
};
