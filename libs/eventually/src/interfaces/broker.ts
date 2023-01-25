import { Disposable } from "./generic";

export interface Broker extends Disposable {
  poll(): Promise<boolean>;
}
