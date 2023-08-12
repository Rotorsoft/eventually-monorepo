import { CommandTarget, Infer, Snapshot, client } from "@rotorsoft/eventually";
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
  client().command("RequestBooking", {}, target(room)) as Promise<Snaps>;
