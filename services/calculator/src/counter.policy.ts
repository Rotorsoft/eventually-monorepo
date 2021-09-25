import {
  App,
  CommittedEvent,
  Policy,
  PolicyResponse
} from "@rotorsoft/eventually";
import { Commands, commands } from "./calculator.commands";
import { Digits } from "./calculator.models";
import { Calculator } from "./calculator.aggregate";
import { Events } from "./calculator.events";

const policy = async (
  streamId: string,
  version?: string
): Promise<PolicyResponse<Commands>> => {
  const id = streamId.substr("Calculator:".length);
  const { state } = await App().load(Calculator(id));
  if ((state.left || "").length >= 5 || (state.right || "").length >= 5)
    return {
      id,
      expectedVersion: version,
      command: commands.Reset()
    };
};

export const Counter = (): Policy<
  Commands,
  Pick<Events, "DigitPressed" | "DotPressed">
> => ({
  name: () => "Counter",

  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>
  ) => policy(event.aggregateId, event.aggregateVersion),

  onDotPressed: async (event: CommittedEvent<"DotPressed", undefined>) =>
    policy(event.aggregateId, event.aggregateVersion)
});
