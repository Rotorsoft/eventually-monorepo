import { InMemoryBroker, InMemoryStore } from ".";
import { config } from "..";
import { AppBase } from "../AppBase";
import { Listener } from "../types";

export class InMemoryApp extends AppBase {
  build(): Listener {
    this._store = InMemoryStore();
    this._broker = InMemoryBroker(this);
    return {};
  }

  async listen(): Promise<void> {
    await this.connect();
    this.log.info("white", "InMemory app is listening...", config);
    return Promise.resolve();
  }
}
