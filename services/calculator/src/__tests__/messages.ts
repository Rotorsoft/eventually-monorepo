import {
  Calculator,
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
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "PressKey", { key }, { id });

export const reset = (
  http: Client,
  id: string
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "Reset", {}, { id });

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
