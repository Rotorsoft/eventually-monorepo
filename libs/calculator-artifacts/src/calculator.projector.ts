import {
  CommittedEvent,
  Empty,
  Projector,
  ZodEmpty
} from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./calculator.schemas";

export const TotalsSchema = z.record(
  z.enum([...schemas.DIGITS, ...schemas.OPERATORS, ...schemas.SYMBOLS]),
  z.number()
);

export type Totals = z.infer<typeof TotalsSchema>;

export type TotalsEvents = {
  DigitPressed: z.infer<typeof schemas.DigitPressed>;
  OperatorPressed: z.infer<typeof schemas.OperatorPressed>;
  DotPressed: Empty;
  EqualsPressed: Empty;
};

export const CalculatorTotals = (
  eventOrId: CommittedEvent<TotalsEvents> | string
): Projector<Totals, TotalsEvents> => ({
  description: "Counts all keys pressed by calculator",
  schemas: {
    state: TotalsSchema,
    events: {
      DigitPressed: schemas.DigitPressed,
      OperatorPressed: schemas.OperatorPressed,
      DotPressed: ZodEmpty,
      EqualsPressed: ZodEmpty
    }
  },
  id: () =>
    typeof eventOrId === "string" ? eventOrId : `Totals-${eventOrId.stream}`,
  init: () => {
    return {} as Record<schemas.Keys, number>;
  },
  reduce: {
    DigitPressed: (state, { data }) => ({
      ...state,
      [data.digit]: (state[data.digit] || 0) + 1
    }),
    OperatorPressed: (state, { data }) => ({
      ...state,
      [data.operator]: (state[data.operator] || 0) + 1
    }),
    DotPressed: (state) => ({ ...state, ".": (state["."] || 0) + 1 }),
    EqualsPressed: (state) => ({ ...state, "=": (state["="] || 0) + 1 })
  }
});
