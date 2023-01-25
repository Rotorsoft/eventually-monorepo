import { client } from "@rotorsoft/eventually";
import { Request, Response } from "express";
import { Hotel } from "../Hotel.projector";
import { Next30Days } from "../Next30Days.projector";
import { addDays } from "../utils";

export const home = async (_: Request, res: Response): Promise<void> => {
  try {
    const _rooms = await client().read(Hotel, [
      "Room-101",
      "Room-102",
      "Room-103",
      "Room-104",
      "Room-105"
    ]);
    const tomorrow_key = addDays(new Date(), 1).toISOString().substring(0, 10);
    const days = await client().read(Next30Days, [tomorrow_key]);
    const tomorrow = days[tomorrow_key]?.state;
    const rooms = Object.values(_rooms)
      .map((r) => r.state)
      .map(({ number, type, price, reserved }) => ({
        number,
        type,
        price,
        reserved: reserved ? Object.keys(reserved).length : 0
      }))
      .sort((a, b) => a.number - b.number);

    res.render("home", {
      tomorrow,
      rooms
    });
  } catch (error) {
    console.log(error);
  }
};
