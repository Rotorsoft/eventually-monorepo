import {
  bind,
  client,
  Command,
  CommittedEvent,
  PolicyFactory,
  ProcessManagerFactory,
  ZodEmpty
} from "@rotorsoft/eventually";
import { z } from "zod";
import { Calculator } from "./calculator.aggregate";
import * as schemas from "./calculator.schemas";

const policy = async (
  counter: CounterState | undefined,
  stream: string,
  threshold: number
): Promise<Command<schemas.CounterCommands> | undefined> => {
  if (counter) {
    if (counter.count >= threshold) return bind("Reset", {}, { stream });
  } else {
    const { state } = await client().load(Calculator, stream);
    if (
      (state?.left || "").length >= threshold ||
      (state?.right || "").length >= threshold
    )
      return bind("Reset", {}, { stream });
  }
};

type CounterState = z.infer<typeof schemas.CounterState>;

export const Counter: ProcessManagerFactory<
  CounterState,
  schemas.CounterCommands,
  schemas.CounterEvents
> = (eventOrStream: CommittedEvent<schemas.CounterEvents> | string) => ({
  description: "A counter saga",
  stream:
    typeof eventOrStream === "string" ? eventOrStream : eventOrStream.stream,
  schemas: {
    state: schemas.CounterState,
    commands: { Reset: "After 5 digits or dots in a row" },
    events: {
      DigitPressed: schemas.DigitPressed,
      DotPressed: ZodEmpty,
      OperatorPressed: schemas.OperatorPressed,
      EqualsPressed: ZodEmpty,
      Cleared: ZodEmpty
    }
  },
  init: (): CounterState => ({ count: 0 }),

  on: {
    DigitPressed: (event, state) => policy(state, event.stream, 4),
    DotPressed: (event, state) => policy(state, event.stream, 4),
    EqualsPressed: () => undefined,
    OperatorPressed: () => undefined,
    Cleared: () => undefined
  },

  reduce: {
    DigitPressed: (model) => ({
      count: model.count + 1
    }),
    DotPressed: (model) => ({
      count: model.count + 1
    }),
    EqualsPressed: () => ({ count: 0 }),
    OperatorPressed: () => ({ count: 0 }),
    Cleared: () => ({ count: 0 })
  }
});

export const StatelessCounter: PolicyFactory<
  schemas.CalculatorCommands,
  schemas.CounterEvents
> = () => ({
  description: "A stateless counter policy",
  schemas: {
    commands: {
      PressKey: "Never invoked",
      Reset: "After length of left or right greater than 5"
    },
    events: {
      DigitPressed: schemas.DigitPressed,
      DotPressed: ZodEmpty,
      EqualsPressed: ZodEmpty,
      OperatorPressed: schemas.OperatorPressed,
      Cleared: ZodEmpty
    }
  },
  on: {
    DigitPressed: (event) => policy(undefined, event.stream, 5),
    DotPressed: (event) => policy(undefined, event.stream, 5),
    EqualsPressed: () => undefined,
    OperatorPressed: () => undefined,
    Cleared: () => undefined
  }
});

export const IgnoredHandler: PolicyFactory<
  Pick<schemas.AllCommands, "Whatever">,
  Pick<schemas.AllEvents, "Ignored1" | "Ignored2">
> = () => ({
  description: "Ignoring everything",
  schemas: {
    commands: { Whatever: "never invoked" },
    events: {
      Ignored1: ZodEmpty,
      Ignored2: ZodEmpty
    }
  },
  on: {
    Ignored1: () => undefined,
    Ignored2: () => undefined
  }
});
