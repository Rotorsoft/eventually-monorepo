import { app, camelize, formatTime } from "@rotorsoft/eventually";
import { OAS_UI, config } from "../config";
import { artifacts } from "./artifacts";

const doc = (
  title: string,
  version: string,
  dependencies: Record<string, string>,
  ui: OAS_UI,
  status: Record<string, string>
): string => `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0/dist/css/bootstrap.min.css"
      integrity="sha384-gH2yIJqKdNHPEq0n4Mqa/HGKIhSkIHeL5AyhkYV8i59U5AR6csBvApHHNl/vI1Bx"
      crossorigin="anonymous"
    />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.1/font/bootstrap-icons.css"
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Caveat&family=Handlee&family=Inconsolata:wght@300&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <nav class="navbar navbar-expand-lg bg-body-tertiary">
      <div class="container-fluid">
        <a class="navbar-brand" href="#">${title}<sup><small>${version}</small></sup></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav">
            <li class="nav-item">
              <a class="nav-link" href="/swagger">Swagger</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="/_health">Health</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <div class="accordion id="accordion">
      <div class="accordion-item">
        <h2 class="accordion-header" id="ahOne">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acOne" aria-expanded="false" aria-controls="acOne">
            Service
          </button>
        </h2>
        <div id="acOne" class="accordion-collapse collapse" aria-labelledby="ahOne">
          <div class="accordion-body">
            <div class="row row-cols-2">
              <div class="col">
                <div class="card">
                  <div class="card-body">
                    <h5 class="card-title">Status</h5>
                    <ul class="list-group list-group-flush">
                        ${Object.entries(status)
                          .map(
                            ([k, v]) =>
                              `<li class="list-group-item"><b>${k}</b>: ${v}</li>`
                          )
                          .join("")}
                    </ul>
                  </div>
                </div>
              </div>
              <div class="col">
                <div class="card">
                  <div class="card-body">
                    <h5 class="card-title">Dependencies</h5>
                    <ul class="list-group list-group-flush">
                        ${Object.entries(dependencies)
                          .map(
                            ([k, v]) =>
                              `<li class="list-group-item"><b>${k}</b>: ${v}</li>`
                          )
                          .join("")}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="ahThree">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acThree" aria-expanded="false" aria-controls="acThree">
            Model
          </button>
        </h2>
        <div id="acThree" class="accordion-collapse collapse" aria-labelledby="ahThree">
          <div class="accordion-body">
            <div class="overflow-hidden" style="max-height:600px" id="esml-container"></div>
          </div>
          <div class="accordion-body">
            <div class="row row-cols-auto g-4">
              ${artifacts()}
            </div>
          </div>
        </div>
      </div>

      <div class="accordion-item">
        <h2 class="accordion-header" id="ahTwo">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acTwo" aria-expanded="false" aria-controls="acTwo">
            API
          </button>
        </h2>
        <div id="acTwo" class="accordion-collapse collapse" aria-labelledby="ahTwo">
          <div class="accordion-body">
            ${
              ui === "Redoc"
                ? `
            <redoc spec-url='/swagger'></redoc>
            <script src="https://unpkg.com/redoc@latest/bundles/redoc.standalone.js"></script>`
                : ui === "Rapidoc"
                ? `
            <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
            <rapi-doc spec-url="/swagger" theme="light" show-header="false" regular-font="monospace" render-style="view"></rapi-doc>`
                : `
            <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
            <div id="swagger-ui"></div>
            <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js" crossorigin></script>
            <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-standalone-preset.js" crossorigin></script>
            <script>
              window.onload = () => {
                window.ui = SwaggerUIBundle({
                  url: '/swagger',
                  dom_id: '#swagger-ui',
                  deepLinking: true,
                  presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                  ],
                  layout: "StandaloneLayout",
                });
              };
            </script>`
            }
          </div>
        </div>
      </div>
    </div>
    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.0/dist/js/bootstrap.bundle.min.js"
      integrity="sha384-A3rJD856KowSb7dwlZdYEkO39Gagi7vIsF0jrRAoQmDKKtQBHUuLZ9AsSv4jD4Xa"
      crossorigin="anonymous"
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@rotorsoft/esml@latest/docs/esml.js"></script>
    <script>
      document.addEventListener("DOMContentLoaded", () => {        
        const container = document.getElementById('esml-container');
        const code = \`${esml()}\`;
        const canvas = new esml.Canvas(document, container);
        canvas.render({ code });
        canvas.fitToContainer();
        onresize = esml.debounce(()=>canvas.fitToContainer(), 1000);
      });
    </script>
  </body>
</html>`;

const esml = (): string => {
  const artifacts = [...app().artifacts.values()].filter(
    (a) => a.type !== "command-adapter"
  );
  const public_commands: string[] = [];
  const code = artifacts
    .map((a) => {
      const sys = a.type === "aggregate" || a.type === "system";
      const outs = sys ? "emits" : "invokes";
      const inputs = a.inputs.map(({ name }) => name).join(",");
      const outputs = a.outputs.map((name) => name).join(",");
      const pub = sys
        ? a.inputs
            .filter(({ scope }) => scope === "public")
            .map(({ name }) => name)
        : [];
      public_commands.push(...pub);
      return `${a.type} ${a.factory.name} ${
        inputs ? `handles ${inputs}` : ""
      } ${outputs ? `${outs} ${outputs}` : ""}`;
    })
    .join("\n");
  return code.concat(
    `\ncontext ${camelize(config.service)}EventuallyService includes Actor,`,
    artifacts.map((a) => a.factory.name).join(","),
    public_commands.length
      ? `\nactor Actor invokes ${public_commands.join(",")}`
      : ""
  );
};

let html = "";
export const home = (): string => {
  const { service, env, logLevel, oas_ui, version, dependencies } = config;
  const status = {
    env,
    logLevel,
    upTime: formatTime(process.uptime()),
    ...Object.entries(process.memoryUsage())
      .map(([k, v]) => ({
        [k]: `${Math.round((v / 1024 / 1024) * 100) / 100} MB`
      }))
      .reduce((p, c) => Object.assign(p, c))
  };
  !html && (html = doc(service, version, dependencies, oas_ui, status));
  return html;
};
