import {
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

const ids = (stream: string): string[] => [`Totals-${stream}`];

const projection = (
  id: string,
  key: schemas.Keys,
  records: Record<string, ProjectionRecord<Totals>>
): Projection<Totals> => {
  const { totals } = (records[id] || { state: { totals: {} } }).state;
  return {
    upsert: [
      { id },
      {
        totals: {
          ...totals,
          [key]: (totals[key] || 0) + 1
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
  load: {
    DigitPressed: (e) => ids(e.stream),
    OperatorPressed: (e) => ids(e.stream),
    DotPressed: (e) => ids(e.stream),
    EqualsPressed: (e) => ids(e.stream)
  },
  on: {
    DigitPressed: (e, records) =>
      projection(ids(e.stream)[0], e.data.digit, records),
    OperatorPressed: (e, records) =>
      projection(ids(e.stream)[0], e.data.operator, records),
    DotPressed: (e, records) => projection(ids(e.stream)[0], ".", records),
    EqualsPressed: (e, records) => projection(ids(e.stream)[0], "=", records)
  }
});
