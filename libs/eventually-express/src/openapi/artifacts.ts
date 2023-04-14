import { Scope, app } from "@rotorsoft/eventually";

const _inputs = (
  link: boolean,
  inputs: { name: string; scope: Scope }[]
): string =>
  inputs.length
    ? `<ul class="list-group list-group-flush">${inputs
        .map(
          ({ name, scope }) =>
            `<li class="list-group-item">${
              link ? `<a href="./_commands/${name}">${name}</a>` : name
            } ${scope === Scope.private ? "🔒" : ""}</li>`
        )
        .join("")}</ul>`
    : "";

const _outputs = (outputs: string[]): string =>
  outputs.length
    ? `<ul class="list-group list-group-flush">${outputs
        .map((o) => `<li class="list-group-item">${o}</li>`)
        .join("")}</ul>`
    : "";

export const artifacts = (): string =>
  [...app().artifacts.values()]
    .map(
      ({ type, factory, inputs, outputs }) => `
        <div class="col"><div class="card h-100 text-dark bg-light mb-3">
        <div class="card-header">${factory.name}  <small>[${type}]</small></div>
        <div class="card-body">
        ${_inputs(type === "aggregate" || type === "system", inputs)}
        <hr />
        ${_outputs(outputs)}
        </div></div></div>`
    )
    .join("");
