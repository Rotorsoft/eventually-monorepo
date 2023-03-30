import z from "zod";
import { bind, ProcessManager } from "../../..";
import * as day from "./day.aggregate";

const schemas = {
  state: z.record(z.object({ requested: z.number(), booked: z.number() })),
  commands: { Book: "Books a day" },
  events: day.schemas.events
};

type MonthState = z.infer<typeof schemas.state>;
type Commands = Pick<day.Commands, "Book">;

export const Month = (): ProcessManager<MonthState, Commands, day.Events> => ({
  description: "Only allows 3 bookings in any given month",
  stream: "Month",
  schemas,
  init: () => ({}),
  reduce: {
    BookingRequested: (state, { metadata }) => {
      const mm = metadata.causation.event?.stream.substring(4, 6);
      if (mm) {
        const month = state[mm] || { requested: 0, booked: 0 };
        month.requested++;
        return { ...state, [mm]: month };
      }
      return state;
    },
    Booked: (state, { metadata }) => {
      const mm = metadata.causation.event?.stream.substring(4, 6);
      if (mm) {
        const month = state[mm] || { requested: 0, booked: 0 };
        month.booked++;
        return { ...state, [mm]: month };
      }
      return state;
    }
  },
  on: {
    BookingRequested: ({ stream }, state) => {
      const mm = stream.substring(4, 6);
      const month = state[mm] || { requested: 0, booked: 0 };
      if (month.requested < 3)
        return Promise.resolve(bind("Book", {}, { stream }));
    },
    Booked: () => undefined
  }
});
