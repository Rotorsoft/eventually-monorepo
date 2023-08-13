import {
  client,
  CommittedEvent,
  Messages,
  Snapshot
} from "@rotorsoft/eventually";
import { Keys } from "../calculator.schemas";
import { Calculator } from "../calculator.aggregate";

export const pressKey = (stream: string, key: Keys): Promise<Snapshot[]> =>
  client().command(Calculator, "PressKey", { key }, { stream });

export const reset = (stream: string): Promise<Snapshot[]> =>
  client().command(Calculator, "Reset", {}, { stream });

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
