import z from "zod";
import { Projector } from "@rotorsoft/eventually";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";

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
  load: {},
  on: {
    RoomOpened: ({ data }) => {
      const id = `Room-${data.number}`;
      const { number, type, price } = data;
      return { upsert: [{ id }, { number, type, price }] };
    },
    RoomBooked: ({ data }) => {
      const id = `Room-${data.number}`;
      const reserved = {} as Record<string, string>;
      let day = data.checkin;
      while (day <= data.checkout) {
        reserved[day.toISOString().substring(0, 10)] = data.id;
        day = new Date(day.valueOf() + 24 * 60 * 60 * 1000);
      }
      return { upsert: [{ id }, { reserved }] };
    }
  }
});
