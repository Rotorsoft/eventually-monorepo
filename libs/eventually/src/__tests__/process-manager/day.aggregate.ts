import z from "zod";
import { Aggregate, bind } from "../../../";

export const schemas = {
  state: z.object({ status: z.enum(["open", "waiting", "booked"]) }),
  commands: {
    RequestBooking: z.object({}),
    Book: z.object({})
  },
  events: {
    BookingRequested: z.object({}),
    Booked: z.object({})
  }
};

export type DayState = z.infer<typeof schemas.state>;
export type Commands = {
  RequestBooking: z.infer<typeof schemas.commands.RequestBooking>;
  Book: z.infer<typeof schemas.commands.Book>;
};
export type Events = {
  BookingRequested: z.infer<typeof schemas.events.BookingRequested>;
  Booked: z.infer<typeof schemas.events.Booked>;
};

// Day aggregates compete for 3 bookings in a Month
export const Day = (stream: string): Aggregate<DayState, Commands, Events> => ({
  description: "A day aggregate",
  stream, // the YYYYMMDD string representation of a day
  schemas,
  init: () => ({ status: "open" }),
  reduce: {
    BookingRequested: () => ({ status: "waiting" }),
    Booked: () => ({ status: "booked" })
  },
  on: {
    RequestBooking: (_, { status }) => {
      if (status === "open")
        return Promise.resolve([bind("BookingRequested", {})]);
      throw new Error(`Cannot request booking when ${status}`);
    },
    Book: (_, { status }) => {
      if (status === "waiting") return Promise.resolve([bind("Booked", {})]);
      throw new Error(`Cannot book when ${status}`);
    }
  }
});
