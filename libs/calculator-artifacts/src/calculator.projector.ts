import { client, Projection, Projector } from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./calculator.schemas";

export const TotalsSchema = z.object({
  id: z.string(),
  [schemas.DIGITS[0]]: z.number().optional(),
  [schemas.DIGITS[1]]: z.number().optional(),
  [schemas.DIGITS[2]]: z.number().optional(),
  [schemas.DIGITS[3]]: z.number().optional(),
  [schemas.DIGITS[4]]: z.number().optional(),
  [schemas.DIGITS[5]]: z.number().optional(),
  [schemas.DIGITS[6]]: z.number().optional(),
  [schemas.DIGITS[7]]: z.number().optional(),
  [schemas.DIGITS[8]]: z.number().optional(),
  [schemas.DIGITS[9]]: z.number().optional()
});

export type Totals = z.infer<typeof TotalsSchema>;

export type TotalsEvents = {
  DigitPressed: z.infer<typeof schemas.DigitPressed>;
};

const projection = async (
  stream: string,
  digit: schemas.Digits
): Promise<Projection<Totals>> => {
  const id = `Totals-${stream}`;
  let totals: Totals | undefined;
  await client().read(CalculatorTotals, id, (r) => (totals = r.state));
  return Promise.resolve({
    upserts: [
      {
        where: { id },
        values: {
          [digit]: ((totals && totals[digit]) || 0) + 1
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
      DigitPressed: schemas.DigitPressed
    }
  },
  on: {
    DigitPressed: (e) => projection(e.stream, e.data.digit)
  }
});
