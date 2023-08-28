import {
  client,
  cmd,
  Message,
  PolicyFactory,
  ZodEmpty
} from "@rotorsoft/eventually";
import { z } from "zod";
import { Calculator } from "./calculator.aggregate";
import * as schemas from "./calculator.schemas";

const policy = async (
  counter: CounterState | undefined,
  stream: string,
  threshold: number
): Promise<
  Message<schemas.CounterCommands, keyof schemas.CounterCommands> | undefined
> => {
  if (counter) {
    if (counter.count >= threshold) return cmd("Reset", {}, stream);
  } else {
    const { state } = await client().load(Calculator, stream);
    if (
      (state?.left || "").length >= threshold ||
      (state?.right || "").length >= threshold
    )
      return cmd("Reset", {}, stream);
  }
};

type CounterState = z.infer<typeof schemas.CounterState>;

export const StatelessCounter: PolicyFactory<
  schemas.CalculatorCommands,
  schemas.CounterEvents
> = () => ({
  description: "A stateless counter policy",
  schemas: {
    commands: {
      PressKey: schemas.PressKey,
      Reset: ZodEmpty
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
    commands: { Whatever: ZodEmpty },
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
