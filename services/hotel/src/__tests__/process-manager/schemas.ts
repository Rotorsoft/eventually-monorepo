import { z } from "zod";

const RoomState = z.object({
  status: z.enum(["open", "waiting", "booked"])
});

const MonthState = z.object({
  booked: z.number(),
  rejected: z.number()
});

const RequestBooking = z
  .object({})
  .describe("Requests new booking. Accepted when room is open.");
const Book = z
  .object({})
  .describe("Books a room. Accepted when room is waiting.");
const Reject = z
  .object({})
  .describe(
    "Rejects booking request, releasing the room. Accepted when room is waiting."
  );

const BookingRequested = z.object({}).describe("Booking was requested");
const Booked = z.object({}).describe("Booking was accepted");
const BookingRejected = z.object({}).describe("Booking was rejected");

export const RoomSchemas = {
  state: RoomState,
  commands: {
    RequestBooking,
    Book,
    Reject
  },
  events: {
    BookingRequested,
    Booked,
    BookingRejected
  }
};

export const MonthSchemas = {
  state: MonthState,
  commands: {
    Book,
    Reject
  },
  events: {
    BookingRequested
  }
};
