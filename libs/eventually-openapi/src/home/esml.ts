import { app, camelize } from "@rotorsoft/eventually";
import { config } from "..";

export const esml = (): Record<string, any> => {
  const artifacts = [...app().artifacts.values()].filter(
    (a) => a.type !== "command-adapter"
  );
  const model = {
    [camelize(config.service)]: artifacts.reduce(
      (model, a) => {
        const sys = a.type === "aggregate" || a.type === "system";
        const art = (model[a.factory.name] = {
          type: a.type
        } as Record<string, any>);
        if (a.inputs.length) art.handles = a.inputs.map((i) => i.name);
        if (a.outputs.length) art[sys ? "emits" : "invokes"] = a.outputs;
        return model;
      },
      {} as Record<string, any>
    )
  };
  return model;
};
