import { InferAggregate, bind, sleep } from "@rotorsoft/eventually";
import { RoomSchemas } from "./schemas";

// Room aggregates compete for 3 bookings in a Month
export const Room = (stream: string): InferAggregate<typeof RoomSchemas> => ({
  description: "A room aggregate",
  stream,
  schemas: RoomSchemas,
  init: () => ({ status: "open" }),
  reduce: {
    BookingRequested: () => ({ status: "waiting" }),
    Booked: () => ({ status: "booked" }),
    BookingRejected: () => ({ status: "open" })
  },
  on: {
    RequestBooking: (_, { status }) => {
      if (status === "open")
        return Promise.resolve([bind("BookingRequested", {})]);
      throw new Error(`Cannot request booking when ${status}`);
    },
    Book: async (_, { status }) => {
      process.env.TIMEOUT &&
        (await sleep(Number.parseInt(process.env.TIMEOUT)));
      if (status === "waiting") return [bind("Booked", {})];
      throw new Error(`Cannot book when ${status}`);
    },
    Reject: (_, { status }) => {
      if (status === "waiting")
        return Promise.resolve([bind("BookingRejected", {})]);
      throw new Error(`Cannot reject when ${status}`);
    }
  }
});
