import { client, Projector } from "@rotorsoft/eventually";
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

export const CalculatorTotals = (): Projector<Totals, TotalsEvents> => ({
  description: "Counts all keys pressed by calculator",
  schemas: {
    state: TotalsSchema,
    events: {
      DigitPressed: schemas.DigitPressed
    }
  },
  on: {
    DigitPressed: async ({ stream, data }, map) => {
      const id = `Totals-${stream}`;

      // try to load persisted state from projector store
      const totals = map.records.get(id) ??
        (await client().read(CalculatorTotals, id)).at(0)?.state ?? { id };

      return [{ id, [data.digit]: (totals[data.digit] ?? 0) + 1 }];
    }
  }
});
