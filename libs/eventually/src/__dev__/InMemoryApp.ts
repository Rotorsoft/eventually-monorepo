import { AggregateFactory, Broker, PolicyFactory, Store } from "..";
import { AppBase } from "../AppBase";
import { MessageFactory, Payload } from "../types";
import { handlersOf } from "../utils";

export class InMemoryApp extends AppBase {
  constructor(store: Store, broker: Broker) {
    super(store, broker);
  }

  withAggregate<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    commands: MessageFactory<C>
  ): void {
    handlersOf(commands).map((f) => {
      const command = f();
      this.register(factory, command);
    });
  }

  withPolicy<C, E>(
    factory: PolicyFactory<C, E>,
    events: MessageFactory<E>
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
