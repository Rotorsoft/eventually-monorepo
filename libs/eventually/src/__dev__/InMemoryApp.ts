import { AggregateFactory, Broker, PolicyFactory, Store } from "..";
import { AppBase } from "../AppBase";
import { MessageFactory, Payload } from "../types";
import { handlersOf } from "../utils";

export class InMemoryApp extends AppBase {
  constructor(store: Store, broker: Broker) {
    super(store, broker);
  }

  withAggregate<Model extends Payload, Commands, Events>(
    factory: AggregateFactory<Model, Commands, Events>,
    commands: MessageFactory<Commands>
  ): void {
    handlersOf(commands).map((f) => {
      const command = f();
      this.register(factory, command);
    });
  }

  withPolicy<Commands, Events>(
    factory: PolicyFactory<Commands, Events>,
    events: MessageFactory<Events>
  ): void {
    const instance = factory();
    handlersOf(events).map((f) => {
      const event = f();
      if (Object.keys(instance).includes("on".concat(event.name)))
        void this.broker.subscribe(instance, event);
    });
  }

  build(): void {
    return;
  }
}
