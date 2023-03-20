import { Disposable } from "./generic";

export interface Broker extends Disposable {
  poll(): void;
  drain(): Promise<void>;
}
