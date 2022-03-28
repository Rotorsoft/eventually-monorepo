import { AppBase } from "../app";
import { config } from "../config";

export class InMemoryApp extends AppBase {
  listen(): void {
    this.log.info("white", "InMemory app is listening...", undefined, config);
  }
}
