import { Infer, InferProcessManager } from "@rotorsoft/eventually";
import { RoomSchemas, MonthSchemas } from "./schemas";

export const MonthlyBookings = (): InferProcessManager<
  typeof MonthSchemas,
  Pick<Infer<typeof RoomSchemas.events>, "Booked" | "BookingRejected">
> => ({
  description: "Only allows 3 bookings in any given month",
  schemas: MonthSchemas,
  init: () => ({ booked: 0, rejected: 0 }),
  reduce: {
    Booked: (state) => {
      //console.log(state, event);
      return {
        booked: state.booked + 1,
        rejected: state.rejected
      };
    },
    BookingRejected: (state) => {
      //console.log(state, event);
      return {
        booked: state.booked,
        rejected: state.rejected + 1
      };
    }
  },
  actor: {
    BookingRequested: ({ created }) => created.getMonth().toString()
  },
  on: {
    BookingRequested: (event, state) => {
      return Promise.resolve({
        name: state.booked < 3 ? "Book" : "Reject",
        data: {},
        stream: event.stream
      });
    }
  }
});
