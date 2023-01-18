import {
  app,
  client,
  dispose,
  projector,
  Snapshot
} from "@rotorsoft/eventually";
import { Hotel } from "../Hotel.projector";
import { Room } from "../Room.aggregate";
import * as models from "../Room.models";
import * as schemas from "../Room.schemas";

const openRoom = (
  room: models.Room
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(Room, "OpenRoom", room, { id: room.number.toString() });

const bookRoom = (
  number: number,
  reservation: models.Reservation
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(
    Room,
    "BookRoom",
    { number, ...reservation },
    { id: number.toString() }
  );

describe("Room", () => {
  beforeAll(async () => {
    app().with(Room).with(Hotel).build();
    await app().listen();

    await openRoom({ number: 101, price: 100, type: schemas.RoomType.SINGLE });
    await openRoom({ number: 102, price: 200, type: schemas.RoomType.DOUBLE });
    await openRoom({ number: 103, price: 300, type: schemas.RoomType.DELUXE });
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should search rooms", async () => {
    const rooms = await projector().load(["Room-101", "Room-102", "Room-103"]);
    expect(Object.values(rooms).length).toBe(3);
  });

  it("should book room", async () => {
    const checkin = new Date();
    const checkout = new Date(checkin.getTime() + 2 * 24 * 60 * 60 * 1000);
    const room = await bookRoom(102, {
      id: "r1",
      checkin,
      checkout,
      totalPrice: 0
    });
    expect(room[0].state?.reservations?.length).toBe(1);
    expect(room[0].state?.reservations?.at(0)?.totalPrice).toBe(
      2 * room[0].state.price
    );
    const roomstate = await projector().load(["Room-102"]);
    expect(roomstate).toEqual({
      ["Room-102"]: {
        state: {
          id: "Room-102",
          number: 102,
          type: schemas.RoomType.DOUBLE,
          price: 200,
          reserved: {
            [checkin.toISOString().substring(0, 10)]: "r1",
            [new Date(checkin.valueOf() + 1 * 24 * 60 * 60 * 1000)
              .toISOString()
              .substring(0, 10)]: "r1",
            [new Date(checkin.valueOf() + 2 * 24 * 60 * 60 * 1000)
              .toISOString()
              .substring(0, 10)]: "r1"
          }
        },
        watermark: 3
      }
    });
  });

  it("should fail booking", async () => {
    const checkin = new Date();
    const checkout = new Date(checkin.getTime() + 2 * 24 * 60 * 60 * 1000);
    await bookRoom(103, {
      id: "r2",
      checkin,
      checkout,
      totalPrice: 0
    });
    await expect(
      bookRoom(103, {
        id: "r3",
        checkin,
        checkout,
        totalPrice: 0
      })
    ).rejects.toThrowError();
  });
});
