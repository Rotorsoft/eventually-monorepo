import { Disposable } from "./generic";

export interface Broker extends Disposable {
  drain(): Promise<void>;
}
