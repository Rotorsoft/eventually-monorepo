import { AxiosResponse } from "axios";
import { CommandHandler, CommittedEvent, EventHandler, Message } from "./core";

/**
 * TODO - implement push or pull broker?
 */

// private _command_handlers: Record<
//   string,
//   { factory: (id: string) => CommandHandler<any, any, any>; path: string }
// > = {};

// abstract routePolicy<Commands, Events>(
//   policy: () => Policy<Commands, Events>,
//   factory: MessageFactory<Events>
// ): Promise<void>;

// abstract routeProjector<Events>(
//   projector: () => Projector<Events>,
//   factory: MessageFactory<Events>
// ): Promise<void>;

// protected register(
//   command: string,
//   factory: (id: string) => CommandHandler<Payload, unknown, unknown>,
//   path: string
// ): void {
//   this._command_handlers[command] = { factory, path };
//   this.log.trace("blue", `   [POST ${command}]`, path);
// }

// protected async subscribe(
//   event: CommittedEvent<string, Payload>,
//   factory: () => { name: () => string } & EventHandler<unknown, unknown>,
//   path: string
// ): Promise<void> {
//   await this.broker.subscribe(event, factory, path);
//   this.log.trace("red", `[POST ${event.name}]`, path);
// }

// async handleEvent<Commands, Events>(
//   policy: Policy<Commands, Events>,
//   event: CommittedEvent<keyof Events & string, Payload>
// ): Promise<PolicyResponse<Commands> | undefined> {
//   this.log.trace("magenta", `\n>>> ${event.name} ${policy.name()}`, event);

//   const response: PolicyResponse<Commands> | undefined = await (
//     policy as any
//   )["on".concat(event.name)](event);

//   if (response) {
//     const { id, command, expectedVersion } = response;
//     const { factory, path } = this._command_handlers[command.name] || {};
//     this.log.trace(
//       "blue",
//       `<<< ${command.name}`,
//       `${path} @ ${expectedVersion}`
//     );
//     if (factory && path)
//       await this.broker.send(command, factory, path, id, expectedVersion);
//   }

//   return response;
// }

// async handleProjection<Events>(
//   projector: Projector<Events>,
//   event: CommittedEvent<keyof Events & string, Payload>
// ): Promise<void> {
//   this.log.trace("green", `\n>>> ${event.name} ${projector.name()}`, event);
//   await (projector as any)["on".concat(event.name)](event);
// }

// async routePolicy<Commands, Events>(
//   policy: () => Policy<Commands, Events>,
//   factory: MessageFactory<Events>
// ): Promise<void> {
//   const instance = policy();
//   const promises = handlersOf(factory).map(async (f) => {
//     const event = f();
//     if (Object.keys(instance).includes("on".concat(event.name))) {
//       const path = "/".concat(
//         decamelize(instance.name()),
//         "/",
//         decamelize(event.name)
//       );
//       this.router.post(
//         path,
//         async (req: Request, res: Response, next: NextFunction) => {
//           const { error, value } = event
//             .schema()
//             .validate(this.broker.body(req.body));
//           if (error) res.status(400).send(error.toString());
//           else {
//             try {
//               const response = await this.handleEvent(policy(), value);
//               return res.status(200).send(response);
//             } catch (error) {
//               this.log.error(error);
//               next(error);
//             }
//           }
//         }
//       );
//       return this.subscribe(event, policy, path);
//     }
//   });
//   await Promise.all(promises);
// }

// async routeProjector<Events>(
//   projector: () => Projector<Events>,
//   factory: MessageFactory<Events>
// ): Promise<void> {
//   const instance = projector();
//   const promises = handlersOf(factory).map(async (f) => {
//     const event = f();
//     if (Object.keys(instance).includes("on".concat(event.name))) {
//       const path = "/".concat(
//         decamelize(instance.name()),
//         "/",
//         decamelize(event.name)
//       );
//       this.router.post(
//         path,
//         async (req: Request, res: Response, next: NextFunction) => {
//           const { error, value } = event
//             .schema()
//             .validate(this.broker.body(req.body));
//           if (error) res.status(400).send(error.toString());
//           else {
//             try {
//               const response = await this.handleProjection(
//                 projector(),
//                 value
//               );
//               return res.status(200).send(response);
//             } catch (error) {
//               this.log.error(error);
//               next(error);
//             }
//           }
//         }
//       );
//       return this.subscribe(event, projector, path);
//     }
//   });
//   await Promise.all(promises);
// }

//await app.routePolicy(Counter, CalculatorEventsFactory);
//await app.routeProjector(CalculatorProjector, CalculatorEventsFactory);

// TODO - Test - test event handlers
// event: <Commands, Events>(
//   policy: Policy<Commands, Events>,
//   event: Message<keyof Events & string, Payload>,
//   id: string,
//   version: string,
//   timestamp: Date = new Date()
// ): Promise<PolicyResponse<Commands> | undefined> => {
//   const committed = {
//     id,
//     version,
//     timestamp,
//     ...event
//   };
//   validate(committed as unknown as Message<string, Payload>);
//   return App().handleEvent(policy, committed);
// }

/**
 * **TODO** Brokers message exchanges between services
 */
export interface Broker {
  /**
   * Subscribes an event handler to an event
   * @param event The event and service path to be subscribed
   */
  subscribe: (
    event: CommittedEvent<string, any>,
    factory: () => { name: () => string } & EventHandler<any, any>,
    path: string
  ) => Promise<void>;

  /**
   * Emits events to subscribed services
   * @param event A committed event to be emitted
   */
  emit(event: CommittedEvent<string, any>): Promise<void>;

  /**
   * Request body adapter
   * @param body The body in a POST request
   */
  body(body: any): any;

  /**
   * Sends a command to a routed service
   * @param command The command instance
   */
  send(
    command: Message<string, any>,
    factory: (id: string) => CommandHandler<any, any, any>,
    path: string,
    id: string,
    expectedVersion?: string
  ): Promise<AxiosResponse | [any, CommittedEvent<string, any>]>;
}
