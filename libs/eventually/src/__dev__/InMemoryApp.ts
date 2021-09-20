import { AppBase } from "../AppBase";
import {
  Aggregate,
  decamelize,
  handlersOf,
  MessageFactory,
  Payload
} from "../core";
import { Store } from "../Store";

export class InMemoryApp extends AppBase {
  constructor(store: Store) {
    super(store);
  }

  use<Model extends Payload, Commands, Events>(
    aggregate: (id: string) => Aggregate<Model, Commands, Events>,
    factory: MessageFactory<Commands>
  ): Promise<void> {
    handlersOf(factory).map((f) => {
      const command = f();
      const path = "/".concat(
        decamelize(aggregate("").name()),
        "/",
        decamelize(command.name)
      );
      this.register(command.name, path);
    });
    return Promise.resolve();
  }

  listen(): void {
    this.log.info("InMemoryApp is listening...");
  }
}
