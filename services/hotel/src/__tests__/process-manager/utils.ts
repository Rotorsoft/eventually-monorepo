import {
  Infer,
  client,
  type CommandTarget,
  type Snapshot
} from "@rotorsoft/eventually";
import { Room } from "./room.aggregate";
import { RoomSchemas } from "./schemas";

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
