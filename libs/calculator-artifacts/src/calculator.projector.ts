import {
  client,
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

const projection = async (
  stream: string,
  key: schemas.Keys
): Promise<Projection<Totals>> => {
  const id = `Totals-${stream}`;
  const records = await client().read(CalculatorTotals, [id]);
  const { totals } = (records[id] || { state: { totals: {} } }).state;
  return Promise.resolve({
    upserts: [
      {
        where: { id },
        values: {
          totals: {
            ...totals,
            [key]: (totals[key] || 0) + 1
          }
        }
      }
    ]
  });
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
  on: {
    DigitPressed: (e) => projection(e.stream, e.data.digit),
    OperatorPressed: (e) => projection(e.stream, e.data.operator),
    DotPressed: (e) => projection(e.stream, "."),
    EqualsPressed: (e) => projection(e.stream, "=")
  }
});
