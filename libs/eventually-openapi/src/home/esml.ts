import { app, camelize, Schema, type State } from "@rotorsoft/eventually";
import { config } from "..";
import { z } from "zod";

const ZOD2TYPE: { [K in z.ZodFirstPartyTypeKind]?: string } = {
  [z.ZodFirstPartyTypeKind.ZodString]: "string",
  [z.ZodFirstPartyTypeKind.ZodNumber]: "number",
  [z.ZodFirstPartyTypeKind.ZodBoolean]: "boolean",
  [z.ZodFirstPartyTypeKind.ZodDate]: "date"
};

const toField = (
  name: string,
  type: any,
  optional = false
): { name: string; type: string; optional: boolean } => {
  if (
    type instanceof z.ZodString ||
    type instanceof z.ZodNumber ||
    type instanceof z.ZodBoolean ||
    type instanceof z.ZodDate ||
    type instanceof z.ZodOptional ||
    type instanceof z.ZodEnum
  ) {
    if (type instanceof z.ZodOptional)
      return toField(name, type._def.innerType, true);
    return {
      name,
      type: ZOD2TYPE[type._def.typeName] ?? "string",
      optional: optional || type.isOptional() || type.isNullable()
    };
  }
  return { name, type, optional };
};

const toSchema = (
  schema: Schema<State>
):
  | { requires?: Record<string, string>; optional?: Record<string, string> }
  | undefined => {
  const fields = Object.entries(
    (schema as unknown as z.ZodObject<State>).shape ?? {}
  ).map(([key, type]) => toField(key, type));
  const requires = fields
    .filter((fld) => !fld.optional)
    .reduce((map, fld) => ({ ...map, [fld.name]: fld.type }), {});
  const optional = fields
    .filter((fld) => fld.optional)
    .reduce((map, fld) => ({ ...map, [fld.name]: fld.type }), {});
  if (!Object.keys(requires).length && !Object.keys(optional).length) return;
  return {
    requires: Object.keys(requires).length ? requires : undefined,
    optional: Object.keys(optional).length ? optional : undefined
  };
};

export const esml = (): Record<string, any> => {
  const artifacts = [...app().artifacts.values()].filter(
    (a) => a.type !== "command-adapter"
  );
  const messages = [...app().messages.values()].filter(
    (m) => m.schema && m.type !== "message"
  );

  const model = {
    [camelize(config.service)]: {
      ...artifacts.reduce(
        (model, a) => {
          const sys = a.type === "aggregate" || a.type === "system";
          const art = (model[a.factory.name] = {
            type: a.type
          } as Record<string, any>);
          if (a.inputs.length) art.handles = a.inputs.map((i) => i.name);
          if (a.outputs.length) art[sys ? "emits" : "invokes"] = a.outputs;
          if (a.schema) art.schema = toSchema(a.schema);
          return model;
        },
        {} as Record<string, any>
      ),
      ...messages.reduce(
        (model, m) => {
          const schema = toSchema(m.schema);
          if (schema)
            model[m.name] = {
              type: m.type,
              schema
            } as Record<string, any>;
          return model;
        },
        {} as Record<string, any>
      )
    }
  };
  return model;
};
