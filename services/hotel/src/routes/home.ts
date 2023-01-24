import { client } from "@rotorsoft/eventually";
import { Request, Response } from "express";
import { Hotel } from "../Hotel.projector";
import { Next30Days } from "../Next30Days.projector";
import { addDays } from "../utils";

export const home = async (_: Request, res: Response): Promise<void> => {
  const rooms = await client().read(Hotel, [
    "Room-101",
    "Room-102",
    "Room-103",
    "Room-104",
    "Room-105"
  ]);
  const tomorrow = addDays(new Date(), 1).toISOString().substring(0, 10);
  const days = await client().read(Next30Days, [tomorrow]);
  res.render("home", {
    tomorrow: days[tomorrow]?.state,
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
