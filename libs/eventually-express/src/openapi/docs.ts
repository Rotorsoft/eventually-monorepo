import { app, formatTime, Scope } from "@rotorsoft/eventually";
import { config, OAS_UIS } from "../config";

const directives = `
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

const diagram = (): string => {
  const artifacts = app().artifacts;
  const d = Object.values(artifacts)
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
              scope === Scope.private ? "🔒" : ""
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

export const doc = (
  title: string,
  version: string,
  ui: OAS_UIS,
  status: Record<string, string>
): string => `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-GLhlTQ8iRABdZLl6O3oVMWSktQOp6b7In1Zl3/Jr59b6EGGoI1aFkw7cmDA6j6gD" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js" integrity="sha384-w76AqPfDkMBDXo30jS1Sgez6pr3x5MlQ1ZAGC+nuZB+EYdgRZgiwxhTBTkF7CXvN" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/graphre/dist/graphre.js"></script>
    <script src="https://unpkg.com/nomnoml/dist/nomnoml.js"></script>
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
              <a class="nav-link" href="/_config">Config</a>
            </li>
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
            Status
          </button>
        </h2>
        <div id="acOne" class="accordion-collapse collapse" aria-labelledby="ahOne">
          <div class="accordion-body">
            <div class="card" style="width: 18rem;">
              <table class="table">
                <tbody>
                  ${Object.entries(status)
                    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="accordion-item">
        <h2 class="accordion-header" id="ahTwo">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acTwo" aria-expanded="false" aria-controls="acTwo">
            Open API
          </button>
        </h2>
        <div id="acTwo" class="accordion-collapse collapse" aria-labelledby="ahTwo">
          <div class="accordion-body">
            ${
              ui === OAS_UIS.Redoc
                ? `
            <redoc spec-url='/swagger'></redoc>
            <script src="https://unpkg.com/redoc@latest/bundles/redoc.standalone.js"></script>`
                : ui === OAS_UIS.Rapidoc
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
      <div class="accordion-item">
        <h2 class="accordion-header" id="ahThree">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#acThree" aria-expanded="false" aria-controls="acThree">
            Model
          </button>
        </h2>
        <div id="acThree" class="accordion-collapse collapse" aria-labelledby="ahThree">
          <div class="accordion-body">
            <canvas id="diagram"></canvas>
          </div>
        </div>
      </div>
    </div>
  </body>
  <script>
    var canvas = document.getElementById('diagram');
    var source = \`${directives}${diagram()}\`;
    nomnoml.draw(canvas, source);
  </script>
</html>`;

export const home = (): string => {
  const { service, env, logLevel, oas_ui, version } = config;
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

  return doc(service, version, oas_ui as OAS_UIS, status);
};
