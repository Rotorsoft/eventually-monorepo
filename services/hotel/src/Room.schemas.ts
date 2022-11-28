import z from "zod";

export enum RoomType {
  SINGLE = "single",
  DOUBLE = "double",
  DELUXE = "deluxe"
}

export const Reservation = z.object({
  id: z.string(),
  checkin: z.date(),
  checkout: z.date(),
  totalPrice: z.number()
});

export const Room = z.object({
  number: z.number(),
  type: z.nativeEnum(RoomType),
  price: z.number(),
  reservations: z.array(Reservation).optional()
});

export const BookRoom = z.intersection(
  z.object({
    number: z.number()
  }),
  Reservation
);

export const SearchRoom = z.object({
  checkin: z.date(),
  checkout: z.date()
});
