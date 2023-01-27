import { client } from "@rotorsoft/eventually";
import { Request, Response } from "express";
import { Hotel, RoomState } from "../Hotel.projector";
import { DaySales, Next30Days } from "../Next30Days.projector";
import { addDays } from "../utils";

export const home = async (_: Request, res: Response): Promise<void> => {
  try {
    const _rooms: Array<RoomState> = [];
    await client().read(
      Hotel,
      ["Room-101", "Room-102", "Room-103", "Room-104", "Room-105"],
      (r) => _rooms.push(r.state)
    );
    const tomorrow_key = addDays(new Date(), 1).toISOString().substring(0, 10);
    let tomorrow: DaySales | undefined;
    await client().read(Next30Days, tomorrow_key, (r) => (tomorrow = r.state));
    const rooms = _rooms
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
