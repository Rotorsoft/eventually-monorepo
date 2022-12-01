import {
  client,
  CommittedEvent,
  Messages,
  Snapshot
} from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Keys } from "../calculator.schemas";

export const pressKey = (id: string, key: Keys): Promise<Snapshot[]> =>
  client().command(Calculator, "PressKey", { key }, { id });

export const reset = (id: string): Promise<Snapshot[]> =>
  client().command(Calculator, "Reset", {}, { id });

export const createEvent = <E extends Messages>(
  name: keyof E & string,
  stream: string,
  data: E[keyof E & string]
): CommittedEvent<E> => ({
  id: 0,
  stream,
  version: 0,
  created: new Date(),
  name,
  data,
  metadata: { correlation: "", causation: {} }
});
