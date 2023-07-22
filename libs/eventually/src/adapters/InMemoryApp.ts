import { Builder } from "../builder";
import { broker, config, log } from "../ports";

/**
 * @category Adapters
 * @remarks In-memory app adapter
 */
export class InMemoryApp extends Builder {
  constructor() {
    super();
  }

  get name(): string {
    return "InMemoryApp";
  }

  dispose(): Promise<void> {
    return super.dispose();
  }

  listen(): Promise<void> {
    log().info("InMemory app is listening...", undefined, config());
    broker().poll();
    return Promise.resolve();
  }
}
