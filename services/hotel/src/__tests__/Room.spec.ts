import {
  app,
  broker,
  client,
  dispose,
  ProjectionRecord,
  Snapshot
} from "@rotorsoft/eventually";
import { Hotel } from "../Hotel.projector";
import { DaySales, Next30Days } from "../Next30Days.projector";
import { Room } from "../Room.aggregate";
import * as models from "../Room.models";
import * as schemas from "../Room.schemas";
import { fromToday, readHomeView } from "../utils";

const openRoom = (
  room: models.Room,
  stream?: string
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(Room, "OpenRoom", room, {
    stream: stream || room.number.toString()
  });

const bookRoom = (
  number: number,
  reservation: models.Reservation,
  stream?: string
): Promise<Snapshot<models.Room, models.RoomEvents>[]> =>
  client().command(
    Room,
    "BookRoom",
    { number, ...reservation },
    { stream: stream || number.toString() }
  );

describe("Room", () => {
  beforeAll(async () => {
    app().with(Room).with(Hotel).with(Next30Days).build();
    await app().listen();

    await openRoom({ number: 101, price: 100, type: schemas.RoomType.SINGLE });
    await openRoom({ number: 102, price: 200, type: schemas.RoomType.DOUBLE });
    await openRoom({ number: 103, price: 300, type: schemas.RoomType.DELUXE });
    await openRoom({ number: 104, price: 400, type: schemas.RoomType.DELUXE });
    await broker().drain();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should search rooms", async () => {
    const len = await client().read(
      Hotel,
      ["Room-101", "Room-102", "Room-103"],
      () => {
        return;
      }
    );
    expect(len).toBe(3);
  });

  it("should book room", async () => {
    const checkin = fromToday(1);
    const checkout = fromToday(2);
    const checkin_key = checkin.toISOString().substring(0, 10);
    const checkout_key = checkout.toISOString().substring(0, 10);

    let room = await bookRoom(102, {
      id: "r1",
      checkin,
      checkout,
      totalPrice: 400
    });
    await broker().drain();

    expect(room[0].state?.reservations?.length).toBe(1);
    expect(room[0].state?.reservations?.at(0)?.totalPrice).toBe(
      room[0].state.price
    );

    let roomstate;
    await client().read(Hotel, "Room-102", (r) => (roomstate = r.state));
    expect(roomstate).toEqual({
      id: "Room-102",
      number: 102,
      type: schemas.RoomType.DOUBLE,
      price: 200,
      reserved: {
        [checkin_key]: "r1",
        [checkout_key]: "r1"
      }
    });

    room = await bookRoom(104, {
      id: "r2",
      checkin,
      checkout,
      totalPrice: 800
    });
    await broker().drain();

    const next30: ProjectionRecord<DaySales>[] = [];
    await client().read(Next30Days, [checkin_key, checkout_key], (r) =>
      next30.push(r)
    );
    expect(next30).toEqual([
      {
        state: { id: checkin_key, total: 600, reserved: [102, 104] },
        watermark: 5
      },
      {
        state: { id: checkout_key, total: 600, reserved: [102, 104] },
        watermark: 5
      }
    ]);

    const { rooms } = await readHomeView();
    expect(rooms.length).toBeGreaterThan(0);
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
    ).rejects.toThrow();
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
    ).rejects.toThrow("BookRoom failed invariant: must be open");

    await expect(
      bookRoom(
        201,
        {
          id: "r3",
          checkin: tomorrow,
          checkout: afterTomorrow,
          totalPrice: 0
        },
        "101"
      )
    ).rejects.toThrow("Invalid room number 201");

    await expect(
      bookRoom(
        101,
        {
          id: "r3",
          checkin: yesterday,
          checkout: afterTomorrow,
          totalPrice: 0
        },
        "101"
      )
    ).rejects.toThrow(
      `Invalid checkin date ${yesterday}. Must be in the future.`
    );

    await expect(
      bookRoom(
        101,
        {
          id: "r3",
          checkin: tomorrow,
          checkout: today,
          totalPrice: 0
        },
        "101"
      )
    ).rejects.toThrow(`Invalid checkout date ${today}. Must be in the future.`);

    await expect(
      bookRoom(
        101,
        {
          id: "r3",
          checkin: afterTomorrow,
          checkout: tomorrow,
          totalPrice: 0
        },
        "101"
      )
    ).rejects.toThrow(
      `Invalid reservation ${afterTomorrow} - ${tomorrow}. Checkin must be earlier than checkout.`
    );
  });
});
