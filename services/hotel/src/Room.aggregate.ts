import { Aggregate, bind } from "@rotorsoft/eventually";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";

const nights = (reservation: models.Reservation): number => {
  const dtime = reservation.checkout.getTime() - reservation.checkin.getTime();
  return Math.round(dtime / (1000 * 3600 * 24));
};

const isBooked = (room: models.Room, from: Date, to: Date): boolean =>
  (room.reservations &&
    room.reservations.some(
      (r) =>
        (from >= r.checkin && from <= r.checkout) ||
        (to >= r.checkin && to <= r.checkout) ||
        (r.checkin >= from && r.checkin <= to) ||
        (r.checkout >= from && r.checkout <= to)
    )) ||
  false;

export const Room = (
  id: string
): Aggregate<models.Room, models.RoomCommands, models.RoomEvents> => ({
  schemas: {
    state: schemas.Room,
    commands: {
      OpenRoom: schemas.Room,
      BookRoom: schemas.BookRoom
    },
    events: {
      RoomOpened: schemas.Room,
      RoomBooked: schemas.BookRoom
    }
  },

  description: "A bookable hotel room",
  stream: () => `Room-${id}`,
  init: (): models.Room => ({
    number: +id,
    type: schemas.RoomType.SINGLE,
    price: 0
  }),
  reduce: {
    RoomOpened: (state, event) => event.data,
    RoomBooked: (state, event) => ({
      ...state,
      reservations: (state?.reservations || []).concat({
        ...event.data,
        totalPrice: nights(event.data) * state.price
      })
    })
  },
  on: {
    OpenRoom: (data) => {
      if (data.number.toString() !== id)
        throw Error(`Invalid room number ${data.number}`);

      return Promise.resolve([bind("RoomOpened", data)]);
    },
    BookRoom: (data, state) => {
      const today = new Date();
      if (data.number !== state.number)
        throw Error(`Invalid room number ${data.number}`);

      if (data.checkin <= today)
        throw Error(
          `Invalid checkin date ${data.checkin}. Must be in the future.`
        );

      if (data.checkout <= today)
        throw Error(
          `Invalid checkout date ${data.checkout}. Must be in the future.`
        );

      if (data.checkin >= data.checkout)
        throw Error(
          `Invalid reservation ${data.checkin} - ${data.checkout}. Checkin must be earlier than checkout.`
        );

      if (isBooked(state, data.checkin, data.checkout))
        throw Error(`Room ${state.number} is booked.`);

      return Promise.resolve([bind("RoomBooked", data)]);
    }
  }
});
