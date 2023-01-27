import { client, ProjectionRecord } from "@rotorsoft/eventually";
import { Request, Response } from "express";
import { Hotel, RoomState } from "../Hotel.projector";
import { DaySales, Next30Days } from "../Next30Days.projector";
import { addDays } from "../utils";

export const home = async (_: Request, res: Response): Promise<void> => {
  const rooms: Array<ProjectionRecord<RoomState>> = [];
  await client().read(
    Hotel,
    ["Room-101", "Room-102", "Room-103", "Room-104", "Room-105"],
    (r) => rooms.push(r)
  );
  const tomorrow_key = addDays(new Date(), 1).toISOString().substring(0, 10);
  let tomorrow: DaySales = { id: "", total: 0, reserved: [] };
  await client().read(Next30Days, tomorrow_key, (r) => (tomorrow = r.state));
  res.render("home", {
    tomorrow,
    rooms: Object.values(rooms)
      .map((r) => r.state)
      .map(({ number, type, price, reserved }) => ({
        number,
        type,
        price,
        reserved: Object.entries(reserved || {})
          .map(([day, id]) => ({ day, id }))
          .sort()
      }))
      .sort((a, b) => a.number - b.number)
  });
};
