import { CommittedEvent } from "../types";
import { Disposable } from "./generic";

export interface Broker extends Disposable {
  start(): Promise<void>;
  on(events: Array<CommittedEvent | undefined>): Promise<void>;
}
