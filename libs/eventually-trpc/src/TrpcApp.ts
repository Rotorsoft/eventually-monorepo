import {
  Builder,
  broker,
  log,
  type AggregateFactory
  // type CommandAdapterFactory,
  // type EventHandlerFactory,
  // type ProjectorFactory,
  // CommandHandlerFactory
} from "@rotorsoft/eventually";
import { httpGetPath, httpPostPath } from "@rotorsoft/eventually-openapi";
import { ProcedureRouterRecord, initTRPC } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { Server } from "http";
import { config } from "./config";

const trpc = initTRPC.create();

/**
 * tRPC app builder
 *
 * @remarks Exposes public interface as tRPC endpoints
 */
export class TrpcApp extends Builder {
  private _procedures: ProcedureRouterRecord = {};
  private _server?: Server;

  constructor() {
    super();
  }

  private _withStreams(): void {
    // this._router.get("/all", queryHandler);
    log()
      .green()
      .info(
        "GET ",
        "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
      );
    // this._router.get("/_stats", statsHandler);
    log().green().info("GET ", "/_stats");
    // this._router.get("/_subscriptions", subscriptionsHandler);
    log().green().info("GET ", "/_subscriptions");
  }

  private _withGets(factory: AggregateFactory): void {
    const path = httpGetPath(factory.name);
    // this._router.get(path, getHandler(factory));
    log().green().info("GET ", path);
    const streamPath = path.concat("/stream");
    // this._router.get(streamPath, getStreamHandler(factory));
    log().green().info("GET ", streamPath);
  }

  private _withPosts(): void {
    this.artifacts.forEach(({ type, factory, inputs }) => {
      const endpoints = inputs
        .filter((input) => input.scope === "public")
        .map((input) => input.name);
      type === "aggregate" && this._withGets(factory as AggregateFactory);
      if (type === "policy" || type === "process-manager") {
        if (endpoints.length) {
          const path = httpPostPath(factory.name, type);
          //this._router.post(path, eventHandler(factory as EventHandlerFactory));
          log().magenta().info("POST", path, endpoints);
        }
      } else if (type === "projector") {
        //const projector_factory = factory as ProjectorFactory;
        //const projector = projector_factory();
        const path = httpPostPath(factory.name, type);
        if (endpoints.length) {
          // projectors expose a route to handle an array of events
          //this._router.post(path, projectHandler(projector_factory));
          log().magenta().info("POST", path, inputs);
        }
        //this._router.get(
        //  path,
        //  readHandler(projector_factory, projector.schemas.state)
        //);
        log().green().info("GET ", path);
      } else
        endpoints.forEach((name) => {
          const path = httpPostPath(factory.name, type, name);
          // if (type === "command-adapter")
          //   this._router.post(
          //     path,
          //     invokeHandler(factory as CommandAdapterFactory)
          //   );
          // else
          //   this._router.post(
          //     path,
          //     commandHandler(
          //       factory as CommandHandlerFactory,
          //       name,
          //       type === "aggregate"
          //     )
          //   );
          log().blue().info("POST", path);
        });
    });
  }

  //TODO: pass options
  build(): void {
    super.build();

    // route artifacts
    this._withPosts();
    this.hasStreams && this._withStreams();

    // add middleware

    // use artifact routes
    //this._app.use(this._router);

    // ensure catch-all is last handler
    //this._app.use(errorHandler);

    // log sanitized config
    const { service, version, env, logLevel } = config;
    log().info("config", service, { env, logLevel, version });
  }

  /**
   * Starts listening for requests
   *
   * WARNING!
   *  - Serverless environments provide their own listening framework
   *  - Use wrappers like serverless-http instead
   *
   * @param port to override port in config
   */
  async listen(port?: number): Promise<void> {
    port = port || config.port;
    this._server = await new Promise((resolve, reject) => {
      try {
        const server = createHTTPServer({
          router: trpc.router(this._procedures)
        });
        server.listen(port);
        log()
          .yellow()
          .underlined()
          .info(`tRPC server is listening on port ${port}`);

        // sync pending subscriptions
        void broker().drain();

        resolve(server.server);
      } catch (error) {
        reject(error);
      }
    });
  }

  get name(): string {
    return "TrcpApp";
  }

  async dispose(): Promise<void> {
    await super.dispose();
    if (this._server) {
      await new Promise((resolve, reject) => {
        this._server && this._server.once("close", resolve);
        this._server && this._server.close(reject);
      });
      this._server = undefined;
    }
  }
}
