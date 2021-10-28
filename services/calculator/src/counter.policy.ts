import {
  app,
  CommandResponse,
  CommittedEvent,
  EvtOf,
  Policy,
  ProcessManager
} from "@rotorsoft/eventually";
import { Calculator } from "./calculator.aggregate";
import { Commands, commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { CounterState, Digits } from "./calculator.models";

const policy = async (
  counter: CounterState,
  event: EvtOf<CounterEvents>,
  threshold: number
): Promise<CommandResponse<Commands>> => {
  if (counter) {
    if (counter.count >= threshold - 1)
      return {
        id: event.stream.substr("Calculator".length),
        expectedVersion: event.version,
        command: commands.Reset()
      };
  } else {
    const id = event.stream.substr("Calculator".length);
    const { state } = await app().load(Calculator(id));
    if (
      (state.left || "").length >= threshold ||
      (state.right || "").length >= threshold
    )
      return {
        id,
        command: commands.Reset()
      };
  }
};

export type CounterEvents = Omit<Events, "Cleared">;

export const Counter = (
  event: EvtOf<Events>
): ProcessManager<CounterState, Commands, CounterEvents> => ({
  stream: () => `Counter${event.stream}`,
  init: (): CounterState => ({ count: 0 }),
  snapshot: {
    threshold: 2
  },

  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>,
    state: CounterState
  ) => policy(state, event, 5),

  onDotPressed: async (
    event: CommittedEvent<"DotPressed", undefined>,
    state: CounterState
  ) => policy(state, event, 5),

  onEqualsPressed: () => undefined,
  onOperatorPressed: () => undefined,

  applyDigitPressed: (model: CounterState) => {
    return { count: model.count + 1 };
  },
  applyDotPressed: (model: CounterState) => {
    return { count: model.count + 1 };
  },

  applyEqualsPressed: () => {
    return { count: 0 };
  },

  applyOperatorPressed: () => {
    return { count: 0 };
  }
});

export const StatelessCounter = (): Policy<Commands, CounterEvents> => ({
  onDigitPressed: async (
    event: CommittedEvent<"DigitPressed", { digit: Digits }>
  ) => policy(undefined, event, 5),

  onDotPressed: async (event: CommittedEvent<"DotPressed", undefined>) =>
    policy(undefined, event, 5),

  onEqualsPressed: () => undefined,
  onOperatorPressed: () => undefined
});
