import { AppBase } from "../app";
import { config } from "../config";

export class InMemoryApp extends AppBase {
  get name(): string {
    return "InMemoryApp";
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  listen(): void {
    this.log.info("white", "InMemory app is listening...", undefined, config);
  }
}
