import { client } from "@rotorsoft/eventually";
import { Hotel, RoomState } from "./Hotel.projector";
import { DaySales, Next30Days } from "./Next30Days.projector";
import { RoomType } from "./Room.schemas";

export const DAY = 24 * 60 * 60 * 1000;
export const fromToday = (days: number): Date =>
  new Date(new Date().valueOf() + days * DAY);
export const addDays = (date: Date, days: number): Date =>
  new Date(date.valueOf() + days * DAY);

export type HomeView = {
  rooms: Array<{
    number: number;
    type: RoomType;
    price: number;
    reserved: number;
  }>;
  tomorrow?: DaySales;
};

export const readHomeView = async (): Promise<HomeView> => {
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

  return { rooms, tomorrow };
};
