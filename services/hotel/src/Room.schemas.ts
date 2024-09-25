import { z } from "zod";

export enum RoomType {
  SINGLE = "single",
  DOUBLE = "double",
  DELUXE = "deluxe"
}

export const Reservation = z.object({
  id: z.string(),
  checkin: z.coerce.date(),
  checkout: z.coerce.date(),
  totalPrice: z.coerce.number()
});

export const Room = z.object({
  number: z.coerce.number(),
  type: z.nativeEnum(RoomType),
  price: z.coerce.number(),
  reservations: z.array(Reservation).optional()
});

export const BookRoom = z.intersection(
  z.object({
    number: z.coerce.number()
  }),
  Reservation
);

export const SearchRoom = z.object({
  checkin: z.coerce.date(),
  checkout: z.coerce.date()
});
