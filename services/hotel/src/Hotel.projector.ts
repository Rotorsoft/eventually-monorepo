import z from "zod";
import { client, Projector } from "@rotorsoft/eventually";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";
import { addDays } from "./utils";

export const RoomStateSchema = z.object({
  id: z.string(),
  number: z.number(),
  type: z.nativeEnum(schemas.RoomType),
  price: z.number(),
  reserved: z.record(z.string())
});
export type RoomState = z.infer<typeof RoomStateSchema>;

export const Hotel = (): Projector<RoomState, models.RoomEvents> => ({
  description: "Hotel read model",
  schemas: {
    state: RoomStateSchema,
    events: {
      RoomOpened: schemas.Room,
      RoomBooked: schemas.BookRoom
    }
  },
  on: {
    RoomOpened: ({ data }) => {
      const id = `Room-${data.number}`;
      const { number, type, price } = data;
      return Promise.resolve({
        upserts: [{ where: { id }, values: { number, type, price } }]
      });
    },
    RoomBooked: async ({ data }) => {
      const id = `Room-${data.number}`;
      let reserved: Record<string, string> = {};
      await client().read(
        Hotel,
        id,
        (room) => (reserved = room.state.reserved || {})
      );
      let day = data.checkin;
      while (day <= data.checkout) {
        reserved[day.toISOString().substring(0, 10)] = data.id;
        day = addDays(day, 1);
      }
      return Promise.resolve({
        upserts: [{ where: { id }, values: { reserved } }]
      });
    }
  }
});
