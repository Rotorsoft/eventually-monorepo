import {
  app,
  bind,
  CommittedEvent,
  Message,
  Payload,
  Policy,
  ProcessManagerFactory
} from "@rotorsoft/eventually";
import { Calculator } from "./calculator.aggregate";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { CounterState } from "./calculator.models";
import * as schemas from "./calculator.schemas";

const policy = async (
  counter: CounterState,
  event: CommittedEvent<string, Payload>,
  threshold: number
): Promise<Message<keyof Commands, undefined>> => {
  if (counter) {
    if (counter.count >= threshold - 1)
      return bind(
        "Reset",
        undefined,
        event.stream.substring("Calculator-".length)
      );
  } else {
    const id = event.stream.substring("Calculator-".length);
    const { state } = await app().load(Calculator(id));
    if (
      (state.left || "").length >= threshold ||
      (state.right || "").length >= threshold
    )
      return bind("Reset", undefined, id);
  }
};

export type CounterEvents = Omit<
  Events,
  "Cleared" | "Ignored1" | "Ignored2" | "Ignored3" | "Forgotten" | "Complex"
>;

export const Counter: ProcessManagerFactory<
  CounterState,
  Commands,
  CounterEvents
> = (event) => ({
  stream: () => `Counter-${event.stream}`,
  schema: () => schemas.CounterState,
  init: (): CounterState => ({ count: 0 }),
  snapshot: {
    threshold: 2
  },

  onDigitPressed: (event, state) => policy(state, event, 5),
  onDotPressed: (event, state) => policy(state, event, 5),
  onEqualsPressed: () => undefined,
  onOperatorPressed: () => undefined,

  applyDigitPressed: (model) => ({
    count: model.count >= 4 ? 0 : model.count + 1
  }),
  applyDotPressed: (model) => ({
    count: model.count >= 4 ? 0 : model.count + 1
  }),
  applyEqualsPressed: () => ({ count: 0 }),
  applyOperatorPressed: () => ({ count: 0 })
});

export const StatelessCounter = (): Policy<Commands, CounterEvents> => ({
  onDigitPressed: (event) => policy(undefined, event, 5),
  onDotPressed: (event) => policy(undefined, event, 5),
  onEqualsPressed: () => undefined,
  onOperatorPressed: () => undefined
});

export const IgnoredHandler = (): Policy<
  undefined,
  Pick<Events, "Ignored1" | "Ignored2">
> => ({
  onIgnored1: () => undefined,
  onIgnored2: () => undefined
});
