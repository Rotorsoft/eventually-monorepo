import {
  app,
  bind,
  CommittedEvent,
  Message,
  Payload,
  Policy,
  ProcessManagerFactory
} from "@andela-technology/eventually";
import { Calculator } from "./calculator.aggregate";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { CounterState } from "./calculator.models";
import * as schemas from "./calculator.schemas";

const policy = async (
  counter: CounterState | undefined,
  event: CommittedEvent,
  threshold: number
): Promise<Message<Commands> | undefined> => {
  if (counter) {
    if (counter.count >= threshold - 1)
      return bind("Reset", {}, event.stream.substring("Calculator-".length));
  } else {
    const id = event.stream.substring("Calculator-".length);
    const { state } = await app().load(Calculator, id);
    if (
      (state?.left || "").length >= threshold ||
      (state?.right || "").length >= threshold
    )
      return bind("Reset", {}, id);
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
> = (eventOrId: CommittedEvent<CounterEvents> | string) => ({
  stream: () =>
    typeof eventOrId === "string" ? eventOrId : `Counter-${eventOrId.stream}`,
  schema: () => schemas.CounterState,
  init: (): CounterState => ({ count: 0 }),
  snapshot: {
    threshold: 2
  },

  onDigitPressed: (event, state) => policy(state, event as CommittedEvent, 5),
  onDotPressed: (event, state) => policy(state, event as CommittedEvent, 5),
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
  onDigitPressed: (event) => policy(undefined, event as CommittedEvent, 5),
  onDotPressed: (event) => policy(undefined, event as CommittedEvent, 5),
  onEqualsPressed: () => undefined,
  onOperatorPressed: () => undefined
});

export const IgnoredHandler = (): Policy<
  Record<string, Payload>,
  Pick<Events, "Ignored1" | "Ignored2">
> => ({
  onIgnored1: () => undefined,
  onIgnored2: () => undefined
});
