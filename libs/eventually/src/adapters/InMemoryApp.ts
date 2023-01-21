import { Builder } from "../builder";
import { broker, config, log } from "../ports";

export class InMemoryApp extends Builder {
  constructor() {
    super(config().version);
  }

  get name(): string {
    return "InMemoryApp";
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  listen(): Promise<void> {
    log().info("InMemory app is listening...", undefined, config());
    void broker().start();
    return Promise.resolve();
  }
}
