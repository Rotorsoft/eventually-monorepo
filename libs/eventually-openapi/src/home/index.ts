import { formatTime } from "@rotorsoft/eventually";
import { config, OAS_UI } from "../config";
import { artifacts } from "./artifacts";
import { diagram, directives } from "./diagram";

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
            <canvas id="diagram"></canvas>
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
  </body>
  <script>
    var canvas = document.getElementById('diagram');
    var source = \`${directives}${diagram()}\`;
    nomnoml.draw(canvas, source);
  </script>
</html>`;

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

  return doc(service, version, dependencies, oas_ui, status);
};
