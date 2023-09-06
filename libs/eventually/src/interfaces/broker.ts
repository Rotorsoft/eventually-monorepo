import { Disposable } from "./generic";

export interface Broker extends Disposable {
  drain(times?: number): Promise<void>;
}
