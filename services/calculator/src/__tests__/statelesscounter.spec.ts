import {
  Calculator,
  CounterEvents,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import {
  app,
  CommittedEvent,
  dispose,
  InMemorySnapshotStore
} from "@rotorsoft/eventually";
import {
  EventResponseEx,
  ExpressApp,
  HttpClient
} from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { pressKey, reset } from "./messages";

const chance = new Chance();
const port = 4007;
const http = HttpClient(port);

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator)
  .with(StatelessCounter)
  .with(PressKeyAdapter)
  .withSnapshot(Calculator, {
    store: InMemorySnapshotStore(),
    threshold: 2,
    expose: true
  })
  .build();

describe("calculator with stateless counter express app", () => {
  beforeAll(async () => {
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should reset on last key pressed", async () => {
    const id = chance.guid();

    await reset(http, id);
    await pressKey(http, id, "+");
    await pressKey(http, id, "1");
    await pressKey(http, id, "1");
    await pressKey(http, id, "2");
    await pressKey(http, id, ".");
    await pressKey(http, id, "3");

    const { state } = await http.load(Calculator, id);
    expect(state).toEqual({ result: 0 });
  });

  it("should return no command", async () => {
    const snapshots = await pressKey(http, chance.guid(), "1");
    const { status, command } = (await http.event(
      StatelessCounter,
      snapshots[0].event as CommittedEvent<CounterEvents>
    )) as EventResponseEx;
    expect(status).toBe(200);
    expect(command).toBeUndefined();
  });

  it("should return no command 2", async () => {
    const snapshots = await pressKey(http, chance.guid(), ".");
    const response = await http.event(
      StatelessCounter,
      snapshots[0].event as CommittedEvent<CounterEvents>
    );
    expect(response.command).toBeUndefined();
  });

  it("should throw validation error", async () => {
    await expect(
      http.event(StatelessCounter, {
        id: 1,
        stream: chance.guid(),
        version: 1,
        created: new Date(),
        name: "DigitPressed",
        data: {},
        metadata: { correlation: "", causation: {} }
      })
    ).rejects.toThrowError("Request failed with status code 400");
  });

  it("should throw registration error", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      http.event(StatelessCounter, {
        name: "IgnoreThis"
      } as any)
    ).rejects.toThrowError("Request failed with status code 404");
  });
});
