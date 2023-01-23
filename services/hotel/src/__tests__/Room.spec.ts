import { app, client, dispose, Snapshot } from "@rotorsoft/eventually";
import { Hotel } from "../Hotel.projector";
import { Room } from "../Room.aggregate";
import * as models from "../Room.models";
import * as schemas from "../Room.schemas";

const DAY = 24 * 60 * 60 * 1000;
const fromToday = (days: number): Date =>
  new Date(new Date().valueOf() + days * DAY);

const openRoom = (
  room: models.Room,
  id?: string
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(Room, "OpenRoom", room, {
    id: id || room.number.toString()
  });

const bookRoom = (
  number: number,
  reservation: models.Reservation,
  id?: string
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(
    Room,
    "BookRoom",
    { number, ...reservation },
    { id: id || number.toString() }
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
    const rooms = await client().read(Hotel, [
      "Room-101",
      "Room-102",
      "Room-103"
    ]);
    expect(Object.values(rooms).length).toBe(3);
  });

  it("should book room", async () => {
    const checkin = fromToday(1);
    const checkout = fromToday(2);

    const room = await bookRoom(102, {
      id: "r1",
      checkin,
      checkout,
      totalPrice: 0
    });
    expect(room[0].state?.reservations?.length).toBe(1);
    expect(room[0].state?.reservations?.at(0)?.totalPrice).toBe(
      room[0].state.price
    );
    const roomstate = await client().read(Hotel, ["Room-102"]);
    expect(roomstate).toEqual({
      ["Room-102"]: {
        state: {
          id: "Room-102",
          number: 102,
          type: schemas.RoomType.DOUBLE,
          price: 200,
          reserved: {
            [checkin.toISOString().substring(0, 10)]: "r1",
            [checkout.toISOString().substring(0, 10)]: "r1"
          }
        },
        watermark: 3
      }
    });
  });

  it("should fail booking", async () => {
    const checkin = fromToday(1);
    const checkout = fromToday(2);
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

  it("should fail invariants", async () => {
    const today = fromToday(0);
    const yesterday = fromToday(-1);
    const tomorrow = fromToday(1);
    const afterTomorrow = fromToday(2);

    await expect(
      openRoom(
        { number: 200, price: 100, type: schemas.RoomType.DELUXE },
        "201"
      )
    ).rejects.toThrow("Invalid room number 200");

    await expect(
      bookRoom(
        200,
        {
          id: "r3",
          checkin: tomorrow,
          checkout: afterTomorrow,
          totalPrice: 0
        },
        "201"
      )
    ).rejects.toThrow("Invalid room number 200");

    await expect(
      bookRoom(
        200,
        {
          id: "r3",
          checkin: tomorrow,
          checkout: afterTomorrow,
          totalPrice: 0
        },
        "201"
      )
    ).rejects.toThrow("Invalid room number 200");

    await expect(
      bookRoom(200, {
        id: "r3",
        checkin: yesterday,
        checkout: afterTomorrow,
        totalPrice: 0
      })
    ).rejects.toThrow(
      `Invalid checkin date ${yesterday}. Must be in the future.`
    );

    await expect(
      bookRoom(200, {
        id: "r3",
        checkin: tomorrow,
        checkout: today,
        totalPrice: 0
      })
    ).rejects.toThrow(`Invalid checkout date ${today}. Must be in the future.`);

    await expect(
      bookRoom(200, {
        id: "r3",
        checkin: afterTomorrow,
        checkout: tomorrow,
        totalPrice: 0
      })
    ).rejects.toThrow(
      `Invalid reservation ${afterTomorrow} - ${tomorrow}. Checkin must be earlier than checkout.`
    );
  });
});
