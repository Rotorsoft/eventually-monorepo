import {
  App,
  CommittedEvent,
  EvtOf,
  Policy,
  PolicyResponse
} from "@rotorsoft/eventually";
import { Commands, commands } from "./calculator.commands";
import { CounterState, Digits } from "./calculator.models";
import { Calculator } from "./calculator.aggregate";
import { Events } from "./calculator.events";

const policy = async (
  counter: CounterState,
  stream: string,
  version: number,
  threshold: number
): Promise<PolicyResponse<Commands>> => {
  const id = stream.substr("Calculator:".length);
  const { state } = await App().load(Calculator(id));
  if (
    (state.left || "").length >= threshold ||
    (state.right || "").length >= threshold
  )
    return {
      id,
      expectedVersion: version,
      command: commands.Reset()
    };
};

export type CounterEvents = Pick<Events, "DigitPressed" | "DotPressed">;

export const Counter = (
  event: EvtOf<CounterEvents>
): Policy<Commands, CounterEvents, CounterState> => ({
  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>,
    state?: CounterState
  ) => policy(state, event.stream, event.version, 5),

  onDotPressed: async (
    event: CommittedEvent<"DotPressed", undefined>,
    state?: CounterState
  ) => policy(state, event.stream, event.version, 5),

  reducer: {
    stream: () => `Counter:${event.stream}`,
    init: (): CounterState => ({ count: 0 }),
    applyDigitPressed: (model: CounterState) => {
      return { count: model.count + 1 };
    },
    applyDotPressed: (model: CounterState) => {
      return { count: model.count + 1 };
    }
  }
});

export const StatelessCounter = (): Policy<
  Commands,
  Pick<Events, "DigitPressed" | "DotPressed">,
  CounterState
> => ({
  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>,
    state?: CounterState
  ) => policy(state, event.stream, event.version, 100),

  onDotPressed: async (
    event: CommittedEvent<"DotPressed", undefined>,
    state?: CounterState
  ) => policy(state, event.stream, event.version, 100)
});
