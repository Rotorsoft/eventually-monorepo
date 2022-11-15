import { config, formatTime } from "@rotorsoft/eventually";

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

export const home = (): string => {
  const { service, env, logLevel } = config();
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

  return `<!doctype html>
<html>
  <head>
    <title>${service}</title>
    <meta charset="utf-8">
    <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  </head>
  <body>
    <rapi-doc spec-url="/swagger" theme="dark" show-header="false">
      <div style="display:flex; font-size:12px; color:black; padding:12px 12px; margin: 0; background-color: #f76b39;">
        <div style="display:flex">
        ${Object.entries(status)
          .map(
            ([k, v]) =>
              `<div style="display:flex;padding:12px;"><b>${k}</b>: ${v}</div>`
          )
          .join("")}
        </div>
        <div style="display:flex; flex-direction:column;">
          <div><a href="/swagger">swagger</a></div>
          <div><a href="/redoc">redoc</a></div>
          <div><a href="/_health">health</a></div>
          <div><a href="/_endpoints">endpoints<a></div>
        </div>
      </div>
    </rapi-doc>
  </body>
</html>`;
};
