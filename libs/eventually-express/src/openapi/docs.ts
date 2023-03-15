import { app, formatTime } from "@rotorsoft/eventually";
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
        .map(({ name }) => `[<${i_t}>${name}]\n[${name}] - [${a.factory.name}]`)
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

export const redoc = (title: string): string => `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/swagger'></redoc>
    <script src="https://unpkg.com/redoc@latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;

export const rapidoc = (
  title: string,
  status: Record<string, string>
): string => `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8">
    <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
    <script src="https://unpkg.com/graphre/dist/graphre.js"></script>
    <script src="https://unpkg.com/nomnoml/dist/nomnoml.js"></script>
    <style>
      body { font-size: 12px; }
      .header { display:flex; font-size:12px; color:black; margin: 0; background-color:silver; }
      .header>div { display:flex; }
      .header>div>div { display:flex; padding:12px; }
      .diagram { width:100%; max-height:400px; background-color:#cccccc; overflow:scroll; }
    </style>
  </head>
  <body>
  <rapi-doc spec-url="/swagger" theme="light" show-header="false" regular-font="monospace" render-style="view">
        <div class="diagram">
          <canvas id="diagram"></canvas>
        </div>
        <div class="header">
        <div>
        ${Object.entries(status)
          .map(([k, v]) => `<div><b>${k}</b>: ${v}</div>`)
          .join("")}
        </div>
        <div style="flex:1;justify-content:end">
          <div><a href="/_config">config</a></div>
          <div><a href="/swagger">swagger</a></div>
          <div><a href="/_health">health</a></div>
        </div>
      </div>
    </rapi-doc>
  </body>
  <script>
    var canvas = document.getElementById('diagram');
    var source = \`${directives}${diagram()}\`;
    nomnoml.draw(canvas, source);
  </script>
</html>`;

export const swaggerUI = (
  title: string,
  status: Record<string, string>
): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="SwaggerUI" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
    <style>
      body { font-size: 10px; font-family: monospace; }
      .header { display:flex; font-size:10px; color:black; margin: 0; background-color:silver; }
      .header>div { display:flex; }
      .header>div>div { display:flex; padding:12px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
      ${Object.entries(status)
        .map(([k, v]) => `<div><b>${k}</b>: ${v}</div>`)
        .join("")}
      </div>
      <div style="flex:1;justify-content:end">
        <div><a href="/_config">config</a></div>
        <div><a href="/_health">health</a></div>
      </div>
    </div>
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
    </script>
  </body>
</html>`;

export const home = (): string => {
  const { service, env, logLevel, oas_ui } = config;
  const status = {
    env,
    logLevel,
    upTime: formatTime(process.uptime()),
    ...Object.entries(process.memoryUsage())
      .map(([k, v]) => ({
        [k]: `${Math.round((v / 1024 / 1024) * 100) / 100}MB`
      }))
      .reduce((p, c) => Object.assign(p, c))
  };

  return oas_ui === OAS_UIS.SwaggerUI
    ? swaggerUI(service, status)
    : oas_ui === OAS_UIS.Rapidoc
    ? rapidoc(service, status)
    : redoc(service);
};
