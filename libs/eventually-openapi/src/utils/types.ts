import { Breaker } from "@rotorsoft/eventually";
import { oas31 } from "openapi3-ts";

export type ExtendedSchemaObject = oas31.SchemaObject & {
  name: string;
  refs?: string[];
  inSnapshot?: boolean;
};

export type ExtendedPathItemObject = oas31.PathItemObject & {
  path: string;
  refs?: string[];
};

export type Conflict = {
  path: string;
  conflict: string;
  producer?: string;
  consumer?: string;
};

export type EventContract = {
  name: string;
  schema?: ExtendedSchemaObject;
  producers: Record<string, string>;
  consumers: Record<
    string,
    { id: string; path: string; schema: ExtendedSchemaObject }
  >;
  conflicts?: Conflict[];
};

export type ServiceSpec = {
  breaker?: Breaker;
  discovered?: Date;
  version?: string;
  eventHandlers?: Record<string, ExtendedPathItemObject>;
  commandHandlers?: Record<string, ExtendedPathItemObject>;
  schemas?: Record<string, ExtendedSchemaObject>;
  allPath?: string;
};

export type OpenAPIObject = oas31.OpenAPIObject;
