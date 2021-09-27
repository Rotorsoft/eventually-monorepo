import { InMemoryBroker, InMemoryStore } from ".";
import { AppBase } from "../AppBase";
import { Listener } from "../types";

export class InMemoryApp extends AppBase {
  async build(): Promise<Listener> {
    this._store = InMemoryStore();
    this._broker = InMemoryBroker(this);

    await this.buildTopics();

    await Promise.all(
      Object.values(this._event_handlers).map(({ factory, event }) => {
        return this._broker.subscribe(factory, event);
      })
    );

    return Promise.resolve({});
  }
}
