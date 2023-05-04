import { esml } from "@rotorsoft/esml";
import { app } from "@rotorsoft/eventually";

export const diagram = (): string => {
  const code = [...app().artifacts.values()]
    .filter((a) => a.type !== "command-adapter")
    .map((a) => {
      const outs =
        a.type === "aggregate" || a.type === "system" ? "emits" : "invokes";
      const inputs = a.inputs.map(({ name }) => name).join(",");
      const outputs = a.outputs.map((name) => name).join(",");
      return `${a.type} ${a.factory.name} ${
        inputs ? `handles ${inputs}` : ""
      } ${outputs ? `${outs} ${outputs}` : ""}`;
    })
    .join("\n");

  const { svg, width, height } = esml(code, 80);
  const box = `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`;
  return `<svg xmlns: xlink="http://www.w3.org/1999/xlink" ${box}>${
    svg || ""
  }</svg>`;
};
