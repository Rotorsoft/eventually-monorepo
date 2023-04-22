import { ArtifactType, Scope, app } from "@rotorsoft/eventually";

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
            } ${scope === "private" ? "🔒" : ""}</li>`
        )
        .join("")}</ul>`
    : "";

const _outputs = (outputs: string[]): string =>
  outputs.length
    ? `<ul class="list-group list-group-flush">${outputs
        .map((o) => `<li class="list-group-item">${o}</li>`)
        .join("")}</ul>`
    : "";

const _color = (type: ArtifactType): string => {
  switch (type) {
    case "aggregate":
      return "warning";
    case "command-adapter":
      return "primary";
    case "projector":
      return "success";
    case "system":
      return "secondary";
    default:
      return "danger";
  }
};

export const artifacts = (): string =>
  [...app().artifacts.values()]
    .map(
      ({ type, factory, inputs, outputs }) => `
        <div class="col"><div class="card h-100 bg-light} mb-3">
        <div class="card-header bg-${_color(type)}">${factory.name}  </div>
        <div class="card-body p-2">
        <p class="m-0 fw-lighter fst-italic" style="font-size:75%">${
          factory("").description
        }</p>
        ${_inputs(type === "aggregate" || type === "system", inputs)}
        <hr />
        ${_outputs(outputs)}
        </div></div></div>`
    )
    .join("");
