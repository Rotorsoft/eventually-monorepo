import z from "zod";
import * as schemas from "./Room.schemas";

export type Reservation = z.infer<typeof schemas.Reservation>;
export type Room = z.infer<typeof schemas.Room>;
export type BookRoom = z.infer<typeof schemas.BookRoom>;
export type SearchRoom = z.infer<typeof schemas.SearchRoom>;

export type RoomCommands = {
  OpenRoom: Room;
  BookRoom: BookRoom;
};

export type RoomEvents = {
  RoomOpened: Room;
  RoomBooked: BookRoom;
};
