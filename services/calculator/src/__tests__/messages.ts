import {
  CalculatorEvents,
  CalculatorModel,
  Keys
} from "@rotorsoft/calculator-artifacts";
import {
  Client,
  CommittedEvent,
  Messages,
  Snapshot
} from "@rotorsoft/eventually";

export const pressKey = (
  http: Client,
  stream: string,
  key: Keys
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command("PressKey", { key }, { stream });

export const reset = (
  http: Client,
  stream: string
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command("Reset", {}, { stream });

export const createEvent = <E extends Messages>(
  name: keyof E & string,
  stream: string,
  data: E[keyof E & string],
  id: number
): CommittedEvent<E> => ({
  id,
  stream,
  version: 0,
  created: new Date(),
  name,
  data,
  metadata: { correlation: "", causation: {} }
});
