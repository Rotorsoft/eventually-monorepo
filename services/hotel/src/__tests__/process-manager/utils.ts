import { CommandTarget, Infer, Snapshot, client } from "@rotorsoft/eventually";
import { Room } from "./room.aggregate";
import { RoomSchemas } from "./schemas";

export const target = (stream: string): CommandTarget => ({
  stream: stream,
  actor: { id: "actor-id", name: "actor" }
});

type Snaps = Snapshot<
  Infer<typeof RoomSchemas.state>,
  Infer<typeof RoomSchemas.events.BookingRequested>
>[];

export const requestBooking = (room: string): Promise<Snaps> =>
  client().command(Room, "RequestBooking", {}, target(room)) as Promise<Snaps>;
