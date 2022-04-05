import { AppBase } from "../app";
import { config } from "../config";

export class InMemoryApp extends AppBase {
  get name(): string {
    return "InMemoryApp";
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  listen(): Promise<void> {
    this.log.info("white", "InMemory app is listening...", undefined, config);
    return Promise.resolve();
  }
}
