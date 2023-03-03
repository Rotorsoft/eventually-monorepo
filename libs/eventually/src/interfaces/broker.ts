import { Snapshot } from "../types";
import { Disposable } from "./generic";
import { SnapshotStore } from "./stores";

export interface Broker extends Disposable {
  poll(): Promise<boolean>;
  snapshot(
    store: SnapshotStore,
    stream: string,
    snapshot: Snapshot
  ): Promise<boolean>;
}
