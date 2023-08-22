import { CommandTarget, Infer, Snapshot, client } from "@rotorsoft/eventually";
import { RoomSchemas } from "./schemas";
import { Room } from "./room.aggregate";

export const target = (stream: string): CommandTarget => ({
  stream: stream,
  actor: { id: "actor-id", name: "actor" }
});

type Snap = Snapshot<
  Infer<typeof RoomSchemas.state>,
  Infer<typeof RoomSchemas.events.BookingRequested>
>;

export const requestBooking = (room: string): Promise<Snap> =>
  client().command(Room, "RequestBooking", {}, target(room)) as Promise<Snap>;
