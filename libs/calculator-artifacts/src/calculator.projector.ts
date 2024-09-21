import { client, prj, Projector } from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./calculator.schemas";

export const TotalsSchema = z.object({
  id: z.string(),
  t0: z.number().optional(),
  t1: z.number().optional(),
  t2: z.number().optional(),
  t3: z.number().optional(),
  t4: z.number().optional(),
  t5: z.number().optional(),
  t6: z.number().optional(),
  t7: z.number().optional(),
  t8: z.number().optional(),
  t9: z.number().optional()
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
      const t = `t${data.digit}`;

      // try to load persisted state from projector store
      const totals: Totals = (map.records.get(id) as Totals) ??
        (await client().read(CalculatorTotals, id)).at(0)?.state ?? { id };
      //@ts-expect-error ts-will-complain-here
      const acc = totals[t];

      return prj({ id, [t]: (acc ?? 0) + 1 });
    }
  }
});
