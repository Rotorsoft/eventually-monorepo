import {
  CommittedEvent,
  Empty,
  Projection,
  ProjectionRecord,
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

const projection = (
  key: schemas.Keys,
  record: ProjectionRecord<Totals>
): Projection<Totals> => {
  return {
    upsert: [
      { id: record.state.id },
      {
        totals: {
          ...record.state.totals,
          [key]: (record.state.totals[key] || 0) + 1
        }
      }
    ]
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
    DigitPressed: ({ data }, record) => projection(data.digit, record),
    OperatorPressed: ({ data }, record) => projection(data.operator, record),
    DotPressed: (_, record) => projection(".", record),
    EqualsPressed: (_, record) => projection("=", record)
  }
});
