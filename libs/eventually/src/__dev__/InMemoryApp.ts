import { AggregateFactory, PolicyFactory } from "..";
import { AppBase } from "../AppBase";
import { Store } from "../Store";
import { MessageFactory, Payload } from "../types";
import { decamelize, handlersOf } from "../utils";

export class InMemoryApp extends AppBase {
  constructor(store: Store) {
    super(store);
  }

  withAggregate<Model extends Payload, Commands, Events>(
    factory: AggregateFactory<Model, Commands, Events>,
    commands: MessageFactory<Commands>
  ): void {
    handlersOf(commands).map((f) => {
      const command = f();
      const path = "/".concat(
        decamelize(factory("").name()),
        "/",
        decamelize(command.name)
      );
      this.register(command.name, factory, path);
    });
  }

  withPolicy<Commands, Events>(
    factory: PolicyFactory<Commands, Events>,
    events: MessageFactory<Events>
  ): void {
    const instance = factory();
    handlersOf(events).map((f) => {
      const event = f();
      if (Object.keys(instance).includes("on".concat(event.name))) {
        const path = "/".concat(
          decamelize(instance.name()),
          "/",
          decamelize(event.name)
        );
        this.subscribe(event, factory, path);
      }
    });
  }

  listen(): void {
    this.log.info("InMemoryApp is listening...");
  }
}
