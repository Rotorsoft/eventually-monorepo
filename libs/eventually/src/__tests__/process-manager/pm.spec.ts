import {
  app,
  broker,
  client,
  CommandTarget,
  CommittedEvent,
  dispose,
  log,
  Scope,
  sleep,
  Snapshot
} from "../../../";
import { Day, DayState, Events } from "./day.aggregate";
import { Month } from "./month.policy";

const target = (day: string): CommandTarget => ({
  stream: day,
  actor: { id: "actor-id", name: "actor", roles: [] }
});

const requestBooking = (day: string): Promise<Snapshot<DayState, Events>[]> =>
  client().command(Day, "RequestBooking", {}, target(day));

describe("pm", () => {
  beforeAll(() => {
    app().with(Day).with(Month, { scope: Scope.private }).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should book only 3 days", async () => {
    const days = [
      "20230301",
      "20230302",
      "20230303",
      "20230304",
      "20230305",
      "20230401",
      "20230502",
      "20230603",
      "20230704",
      "20230705"
    ];

    await Promise.all(
      days.map((day) =>
        sleep(Math.random() * 10).then(() => requestBooking(day))
      )
    );
    await broker().drain();
    await broker().drain();

    const events: CommittedEvent[] = [];
    await client().query({}, (e) => events.push(e));
    log().events(events);

    const month = await client().load(Month, "Month");
    console.log(month);

    const statuses = { open: 0, waiting: 0, booked: 0 };
    await Promise.all(
      days.map(async (day) => {
        const snap = await client().load(Day, day);
        statuses[snap.state.status] = statuses[snap.state.status] + 1;
      })
    );
    expect(statuses).toEqual({ open: 0, waiting: 2, booked: 8 });
  });
});
