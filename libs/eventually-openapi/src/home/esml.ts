import { app, camelize } from "@rotorsoft/eventually";
import { z } from "zod";
import { config } from "..";

const ZOD2TYPE: { [K in z.ZodFirstPartyTypeKind]?: string } = {
  [z.ZodFirstPartyTypeKind.ZodString]: "string",
  [z.ZodFirstPartyTypeKind.ZodNumber]: "number",
  [z.ZodFirstPartyTypeKind.ZodBoolean]: "boolean",
  [z.ZodFirstPartyTypeKind.ZodDate]: "date",
  [z.ZodFirstPartyTypeKind.ZodNativeEnum]: "string",
  [z.ZodFirstPartyTypeKind.ZodEnum]: "string",
  [z.ZodFirstPartyTypeKind.ZodArray]: "array"
};

const toField = (
  name: string,
  type: any,
  optional: boolean,
  model: Record<string, any>
): {
  name: string;
  type: string;
  optional: boolean;
} => {
  if (
    type instanceof z.ZodString ||
    type instanceof z.ZodNumber ||
    type instanceof z.ZodBoolean ||
    type instanceof z.ZodDate ||
    type instanceof z.ZodOptional ||
    type instanceof z.ZodNativeEnum ||
    type instanceof z.ZodEnum ||
    type instanceof z.ZodObject ||
    type instanceof z.ZodRecord ||
    type instanceof z.ZodArray
  ) {
    if (type instanceof z.ZodOptional)
      return toField(name, type._def.innerType, true, model);
    if (type instanceof z.ZodRecord) {
      const ref = `X${name}${Object.keys(model).length}`;
      model[ref] = {
        type: "schema",
        ...toSchema(type._def.valueType, model)
      };
      return {
        name,
        type: ref,
        optional
      };
    }
    if (type instanceof z.ZodObject) {
      const ref = `X${name}${Object.keys(model).length}`;
      model[ref] = {
        type: "schema",
        ...toSchema(type, model)
      };
      return { name, type: ref, optional };
    }
    return {
      name,
      type: ZOD2TYPE[type._def.typeName] ?? "string",
      optional: optional || type.isOptional() || type.isNullable()
    };
  }
  return { name, type, optional };
};

export const toSchema = (
  schema: any,
  model: Record<string, any>
):
  | { requires?: Record<string, string>; optional?: Record<string, string> }
  | undefined => {
  const fields = Object.entries(
    (schema as z.ZodObject<z.ZodRawShape>).shape ?? {}
  ).map(([key, type]) => toField(key, type, false, model));

  const requires = fields
    .filter((fld) => !fld.optional)
    .reduce((map, fld) => ({ ...map, [fld.name]: fld.type }), {});

  const optional = fields
    .filter((fld) => fld.optional)
    .reduce((map, fld) => ({ ...map, [fld.name]: fld.type }), {});

  if (!Object.keys(requires).length && !Object.keys(optional).length) return;
  const result: {
    requires?: Record<string, string>;
    optional?: Record<string, string>;
  } = {};
  Object.keys(requires).length && (result.requires = requires);
  Object.keys(optional).length && (result.optional = optional);
  return result;
};

export const esml = (): Record<string, any> => {
  const model: Record<string, any> = {};

  [...app().artifacts.values()]
    .filter((a) => a.type !== "command-adapter")
    .forEach((a) => {
      const agg = a.type === "aggregate";
      const art = (model[a.factory.name] = {
        type: a.type
      } as Record<string, any>);
      if (a.inputs.length) art.handles = a.inputs.map((i) => i.name);
      if (a.outputs.length) art[agg ? "emits" : "invokes"] = a.outputs;
      if (a.schema) art.schema = toSchema(a.schema, model);
    });

  [...app().messages.values()]
    .filter((m) => m.schema && m.type !== "message")
    .forEach((m) => {
      const schema = toSchema(m.schema, model);
      if (schema) model[m.name] = { type: m.type, schema };
    });
  return {
    [camelize(config.service)]: model
  };
};
