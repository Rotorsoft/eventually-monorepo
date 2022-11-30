import {
  app,
  bind,
  command,
  dispose,
  InMemorySnapshotStore,
  Snapshot
} from "@rotorsoft/eventually";
import { Room } from "../Room.aggregate";
import * as models from "../Room.models";
import * as schemas from "../Room.schemas";

const openRoom = (room: models.Room): Promise<Snapshot<models.Room>[]> =>
  command(bind("OpenRoom", room, room.number.toString()));

const bookRoom = (
  number: number,
  reservation: models.Reservation
): Promise<Snapshot<models.Room>[]> =>
  command(bind("BookRoom", { number, ...reservation }, number.toString()));

describe("Room", () => {
  const snapshotStore = InMemorySnapshotStore();

  beforeAll(async () => {
    app()
      .with(Room)
      .withSnapshot(Room, {
        store: snapshotStore,
        threshold: -1
      })
      .build();
    await app().listen();

    await openRoom({ number: 101, price: 100, type: schemas.RoomType.SINGLE });
    await openRoom({ number: 102, price: 200, type: schemas.RoomType.DOUBLE });
    await openRoom({ number: 103, price: 300, type: schemas.RoomType.DELUXE });
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should search rooms", async () => {
    const rooms = await snapshotStore.query({});
    expect(rooms.length).toBe(3);
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
