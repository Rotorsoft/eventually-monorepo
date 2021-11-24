import { AppBase } from "../app";
import { config } from "../config";

export class InMemoryApp extends AppBase {
  async listen(): Promise<void> {
    await super.listen();
    this.log.info("white", "InMemory app is listening...", undefined, config);
  }
}
