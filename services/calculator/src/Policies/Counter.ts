import {
  App,
  CommittedEvent,
  Policy,
  PolicyResponse
} from "@rotorsoft/eventually";
import {
  CalculatorCommands,
  CalculatorCommandsFactory
} from "../Aggregates/Calculator.Commands";
import { CounterEvents } from "./Counter.Events";
import { Digits } from "../Aggregates/Calculator.Model";
import { Calculator } from "../Aggregates/Calculator";

const policy = async (
  streamId: string,
  version?: string
): Promise<PolicyResponse<CalculatorCommands> | undefined> => {
  const id = streamId.substr("Calculator:".length);
  const calculator = await App().load(Calculator(id));
  if (
    (calculator.left || "").length >= 5 ||
    (calculator.right || "").length >= 5
  )
    return {
      id,
      expectedVersion: version,
      command: CalculatorCommandsFactory.Reset()
    };
};

export const Counter = (): Policy<CalculatorCommands, CounterEvents> => ({
  name: () => "Counter",

  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>
  ) => policy(event.aggregateId, event.aggregateVersion),

  onDotPressed: async (event: CommittedEvent<"DotPressed", undefined>) =>
    policy(event.aggregateId, event.aggregateVersion)
});
