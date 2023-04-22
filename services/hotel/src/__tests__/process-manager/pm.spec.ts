import {
  app,
  broker,
  client,
  CommittedEvent,
  dispose,
  log,
  sleep
} from "@rotorsoft/eventually";
import { Room } from "./room.aggregate";
import { MonthlyBookings } from "./monthly-bookings.policy";
import { requestBooking } from "./utils";

describe("pm", () => {
  beforeAll(() => {
    app().with(Room).with(MonthlyBookings, { scope: "private" }).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should book only 3 days", async () => {
    const rooms = ["301", "302", "303", "304", "305", "401"];

    await Promise.all(
      rooms.map((room) =>
        sleep(Math.random() * 100).then(() => requestBooking(room))
      )
    );
    await sleep(100);
    await broker().drain();
    await sleep(100);
    await broker().drain();

    const events: CommittedEvent[] = [];
    await client().query({}, (e) => events.push(e));
    log().events(events);

    const month: CommittedEvent[] = [];
    await client().query(
      {
        limit: 10,
        actor: new Date().getMonth().toString()
      },
      (e) => month.push(e)
    );
    log().events(month);

    const statuses = { open: 0, waiting: 0, booked: 0 };
    await Promise.all(
      rooms.map(async (room) => {
        const snap = await client().load(Room, room);
        statuses[snap.state.status] = statuses[snap.state.status] + 1;
      })
    );
    expect(statuses).toEqual({ open: 3, waiting: 0, booked: 3 });
  });
});
