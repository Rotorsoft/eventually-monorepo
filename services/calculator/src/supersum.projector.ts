import { InMemoryProjectionStore, Projector } from "@rotorsoft/eventually";
import { Events } from "./calculator.events";

type SuperSumModel = { sum: number };

export const SuperSum = (): Projector<
  SuperSumModel,
  Pick<Events, "DigitPressed">
> => ({
  store: InMemoryProjectionStore,
  onDigitPressed: (data, state) => {
    const updated: SuperSumModel = {
      sum: Number.parseInt(data.digit) + (state?.sum || 0)
    };
    return updated;
  }
});
