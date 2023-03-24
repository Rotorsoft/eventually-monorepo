import {
  Calculator,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import {
  app,
  dispose,
  InMemorySnapshotStore,
  Scope,
  sleep
} from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { pressKey } from "./messages";

const chance = new Chance();
const port = 4008;
const http = HttpClient(port);

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator, { store: InMemorySnapshotStore(2), scope: Scope.public })
  .with(StatelessCounter)
  .with(PressKeyAdapter)
  .build();

describe("calculator allstream express app", () => {
  beforeAll(async () => {
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  const id = chance.guid();
  let created_after: Date;
  let created_before: Date;
  let dot_correlation: string;

  beforeAll(async () => {
    await pressKey(http, id, "1");
    await pressKey(http, id, "+");
    await sleep(200);
    created_after = new Date();
    await sleep(200);
    await pressKey(http, id, "2");
    const [snap] = await pressKey(http, id, ".");
    dot_correlation = snap?.event?.metadata?.correlation || "";
    await sleep(200);
    created_before = new Date();
    await sleep(200);
    await pressKey(http, id, "3");
    await pressKey(http, id, "=");
  });

  it("should read stream", async () => {
    const { count } = await http.query({ limit: 1 });
    expect(count).toBe(1);
  });

  it("should read stream by name", async () => {
    const { first, count } = await http.query(
      { names: ["DigitPressed"], limit: 3 },
      (e) => {
        expect(e.name).toBe("DigitPressed");
      }
    );
    expect(first?.name).toBe("DigitPressed");
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("should read stream by names", async () => {
    const { count } = await http.query(
      {
        stream: id,
        names: ["DigitPressed", "DotPressed"],
        limit: 8
      },
      (e) => {
        expect(["DigitPressed", "DotPressed"]).toContain(e.name);
      }
    );
    expect(count).toBe(4);
  });

  it("should read stream with after", async () => {
    const { first } = await http.query({ after: 3 });
    expect(first?.id).toBe(4);
  });

  it("should read stream with limit", async () => {
    const { count } = await http.query({ limit: 5 });
    expect(count).toBe(5);
  });

  it("should read stream with after and limit", async () => {
    const { first, count } = await http.query({ after: 2, limit: 2 });
    expect(first?.id).toBe(3);
    expect(count).toBe(2);
  });

  it("should return an empty stream", async () => {
    const { count } = await http.query({ names: [chance.guid()] });
    expect(count).toBe(0);
  });

  it("should read stream with before and after", async () => {
    const { first, count } = await http.query({
      after: 2,
      before: 4,
      limit: 5
    });
    expect(first?.id).toBe(3);
    expect(count).toBe(1);
  });

  it("should read stream with before and after created", async () => {
    const { first, count } = await http.query({
      stream: id,
      created_after,
      created_before,
      limit: 5
    });
    expect(first?.version).toBe(2);
    expect(count).toBe(2);
  });

  it("should read stream by correlation", async () => {
    const { count } = await http.query(
      {
        correlation: dot_correlation,
        limit: 5
      },
      (e) => expect(e.name).toBe("DotPressed")
    );
    expect(count).toBe(1);
  });
});
