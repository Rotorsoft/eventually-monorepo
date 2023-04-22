import { app } from "@rotorsoft/eventually";

export const directives = `
#direction: right
#font: Monospace
#.aggregate: fill=#F1D244 visual=note
#.system: fill=#FFAFDF visual=note
#.projector: fill=#68C40C visual=note
#.policy: fill=#A208BA visual=note
#.process: fill=#A208BA visual=note
#.command: fill=#01BEFE visual=note
#.event: fill=#F5891D visual=note
`;

export const diagram = (): string => {
  const d = [...app().artifacts.values()]
    .filter((a) => a.type !== "command-adapter")
    .map((a) => {
      const i_t =
        a.type === "aggregate" || a.type === "system" ? "command" : "event";
      const o_t =
        a.type === "aggregate" || a.type === "system" ? "event" : "command";

      const inputs = a.inputs
        .map(
          ({ name, scope }) =>
            `[<${i_t}>${name}]\n[${name}] ${
              scope === "private" ? "🔒" : ""
            } - [${a.factory.name}]`
        )
        .join("\n");
      const outputs = a.outputs
        .map((name) => `[<${o_t}>${name}]\n[${a.factory.name}] - [${name}]`)
        .join("\n");
      return `
  [<${a.type.split("-").at(0)}>${a.factory.name}]
  ${inputs}
  ${outputs}
  `;
    })
    .join("");
  return d;
};
