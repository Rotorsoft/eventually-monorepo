import { z } from "zod";
import { client, Projector } from "@rotorsoft/eventually";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";
import { addDays } from "./utils";
import { Room } from "./Room.aggregate";

export const DaySalesSchema = z.object({
  id: z.string(),
  total: z.number(),
  reserved: z.array(z.number())
});
export type DaySales = z.infer<typeof DaySalesSchema>;

export const Next30Days = (): Projector<
  DaySales,
  Pick<models.RoomEvents, "RoomBooked">
> => ({
  description: "Next 30 day reservations",
  schemas: {
    state: DaySalesSchema,
    events: {
      RoomBooked: schemas.BookRoom
    }
  },
  on: {
    RoomBooked: async ({ data }) => {
      const days: string[] = [];
      const today = new Date();
      const last_day = addDays(today, 30);
      let day = data.checkin;
      while (day >= today && day <= last_day && day <= data.checkout) {
        days.push(day.toISOString().substring(0, 10));
        day = addDays(day, 1);
      }
      if (days.length) {
        const room = await client().load(Room, data.number.toString());
        const sales = Object.fromEntries(
          (await client().read(Next30Days, days)).map((r) => [
            r.state.id,
            r.state
          ])
        );

        const upserts = days.map((day) => {
          const record =
            sales[day] || ({ id: day, total: 0, reserved: [] } as DaySales);
          const total = record.total + room.state.price;
          const reserved = record.reserved;
          if (reserved.includes(room.state.number)) return { id: day, total };
          reserved.push(room.state.number);
          return { id: day, total, reserved };
        });
        return upserts;
      }
      return [];
    }
  }
});
