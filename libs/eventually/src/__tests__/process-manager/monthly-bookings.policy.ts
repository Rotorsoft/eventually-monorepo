import { bind, Infer, InferProcessManager } from "../..";
import { RoomSchemas, MonthSchemas } from "./schemas";

export const MonthlyBookings = (): InferProcessManager<
  typeof MonthSchemas,
  Pick<Infer<typeof RoomSchemas.events>, "Booked" | "BookingRejected">
> => ({
  description: "Only allows 3 bookings in any given month",
  schemas: MonthSchemas,
  init: () => ({ booked: 0, rejected: 0 }),
  reduce: {
    Booked: ({ booked, rejected }) => ({
      booked: booked + 1,
      rejected
    }),
    BookingRejected: ({ booked, rejected }) => ({
      booked,
      rejected: rejected + 1
    })
  },
  actor: {
    BookingRequested: ({ created }) => created.getMonth().toString()
  },
  on: {
    BookingRequested: ({ stream }, state) =>
      Promise.resolve(
        bind(state.booked < 3 ? "Book" : "Reject", {}, { stream })
      )
  }
});
