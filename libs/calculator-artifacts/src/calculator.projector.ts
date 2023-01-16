import {
  CommittedEvent,
  Empty,
  Projection,
  Projector,
  ZodEmpty
} from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./calculator.schemas";

export const TotalsSchema = z.object({
  id: z.string(),
  totals: z.record(
    z.enum([...schemas.DIGITS, ...schemas.OPERATORS, ...schemas.SYMBOLS]),
    z.number()
  )
});

export type Totals = z.infer<typeof TotalsSchema>;

export type TotalsEvents = {
  DigitPressed: z.infer<typeof schemas.DigitPressed>;
  OperatorPressed: z.infer<typeof schemas.OperatorPressed>;
  DotPressed: Empty;
  EqualsPressed: Empty;
};

const init = (e: CommittedEvent<TotalsEvents>): Totals => ({
  id: `Totals-${e.stream}`,
  totals: {}
});

const projection = (key: schemas.Keys, state?: Totals): Projection<Totals> => {
  if (!state) throw Error("Invalid state");
  return {
    filter: { id: state.id },
    values: { totals: { ...state.totals, [key]: (state.totals[key] || 0) + 1 } }
  };
};

export const CalculatorTotals = (): Projector<Totals, TotalsEvents> => ({
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
  init: {
    DigitPressed: (e) => init(e),
    OperatorPressed: (e) => init(e),
    DotPressed: (e) => init(e),
    EqualsPressed: (e) => init(e)
  },
  on: {
    DigitPressed: ({ data }, state) => projection(data.digit, state),
    OperatorPressed: ({ data }, state) => projection(data.operator, state),
    DotPressed: (_, state) => projection(".", state),
    EqualsPressed: (_, state) => projection("=", state)
  }
});
