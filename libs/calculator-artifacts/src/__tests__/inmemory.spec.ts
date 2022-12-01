import {
  Actor,
  app,
  client,
  CommittedEvent,
  dispose,
  log,
  Messages,
  Snapshot,
  sleep,
  store
} from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Counter, IgnoredHandler } from "../counter.policy";
import { Forget } from "../forget.system";
import { ExternalPayload, PressKeyAdapter } from "../presskey.adapter";
import { InMemorySnapshotStore } from "../../../eventually/src/__dev__";
import { CalculatorCommands, Keys } from "../calculator.schemas";

const chance = new Chance();
const inMemorySnapshots = InMemorySnapshotStore();

const pressKey = (id: string, key: Keys): Promise<Snapshot[]> =>
  client().command(Calculator, "PressKey", { key }, { id });
const reset = (id: string): Promise<Snapshot[]> =>
  client().command(Calculator, "Reset", {}, { id });

app()
  .with(Forget)
  .with(Calculator)
  .with(IgnoredHandler)
  .with(Counter)
  .with(PressKeyAdapter)
  .withSnapshot(Calculator, { store: inMemorySnapshots, threshold: 2 })
  .build();

describe("in memory", () => {
  beforeAll(async () => {
    // just to cover seeds
    await store().seed();
    await inMemorySnapshots.seed();

    jest.clearAllMocks();
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("calculator", () => {
    beforeEach(async () => {
      const d = store().dispose;
      // to clear in-memory store before each test
      d && (await d());
    });

    it("should compute correctly", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");

      // WHEN
      await client().invoke(PressKeyAdapter, {
        id,
        key: "="
      } as ExternalPayload);

      // THEN
      const { state } = await client().load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      // With no Snapshot loading
      let cnt1 = 0;
      await client().load(Calculator, id, false, () => {
        cnt1++;
      });
      expect(cnt1).toBe(6);

      // With Snapshot loading
      let cnt2 = 0;
      await client().load(Calculator, id, true, () => {
        cnt2++;
      });
      expect(cnt2).toBe(2);
    });

    it("should compute correctly 2", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");

      // THEN
      const { state } = await client().load(Calculator, id);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      let cnt = 0;
      await client().load(Calculator, id, false, () => {
        cnt++;
      });
      expect(cnt).toBe(9);
    });

    it("should read aggregate stream", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");
      let cnt = 0;
      await client().load(Calculator, id, false, () => {
        cnt++;
      });
      expect(cnt).toBe(9);
    });

    it("should read aggregate stream using Snapshots", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");
      let cnt = 0;
      await client().load(Calculator, id, true, () => {
        cnt++;
      });
      expect(cnt).toBe(1);
    });

    it("should compute correctly 3", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, ".");
      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, ".");
      await pressKey(id, "2");

      // WHEN
      await pressKey(id, "=");

      // THEN
      const { state } = await client().load(Calculator, id);
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should record metadata with actor", async () => {
      const id = chance.guid();
      const actor: Actor = { name: "the-actor", roles: [] };
      await client().command(
        Calculator,
        "PressKey",
        { key: "1" },
        { id, expectedVersion: -1, actor }
      );
      const snap = await client().load(Calculator, id);
      expect(snap?.event?.metadata?.correlation.length).toEqual(24);
      expect(snap?.event?.metadata?.causation.command?.name).toEqual(
        "PressKey"
      );
    });

    it("should throw concurrency error", async () => {
      const id = chance.guid();
      await pressKey(id, "1");
      await expect(
        client().command(
          Calculator,
          "PressKey",
          { key: "1" },
          { id, expectedVersion: -1 }
        )
      ).rejects.toThrow();
    });

    it("should throw validation error", async () => {
      await expect(
        client().command(Calculator, "PressKey", {}, { id: chance.guid() })
      ).rejects.toThrow();
    });

    it("should throw model invariant violation", async () => {
      await expect(pressKey(chance.guid(), "=")).rejects.toThrowError(
        "Don't have an operator"
      );
    });
  });

  describe("Counter", () => {
    it("should return Reset on DigitPressed", async () => {
      const id = chance.guid();

      // GIVEN
      await reset(id);
      await pressKey(id, "1");
      await pressKey(id, "1");
      await pressKey(id, "2");
      await pressKey(id, ".");

      // WHEN
      await pressKey(id, "3");

      // THEN
      const { event, state } = await client().load(Calculator, id);
      expect(state).toEqual(expect.objectContaining({ result: 0 }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      let cnt = 0;
      await client().load(
        Counter,
        "Counter-".concat(event?.stream || ""),
        false,
        () => {
          cnt++;
        }
      );
      expect(cnt).toBe(5);
    });

    it("should return Reset on DotPressed", async () => {
      const id = chance.guid();

      // GIVEN
      await reset(id);
      await pressKey(id, "1");
      await pressKey(id, "1");
      await pressKey(id, "2");
      await pressKey(id, "2");

      // WHEN
      await pressKey(id, ".");

      // THEN
      const { state } = await client().load(Calculator, id);
      expect(state).toEqual(expect.objectContaining({ result: 0 }));
    });
  });

  describe("all stream", () => {
    const id = chance.guid();
    let created_after: Date, created_before: Date;

    beforeAll(async () => {
      await pressKey(id, "1");
      await pressKey(id, "+");

      await sleep(100);
      created_after = new Date();
      await sleep(100);

      await pressKey(id, "2");
      await pressKey(id, ".");

      await sleep(100);
      created_before = new Date();
      await sleep(100);

      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const { count } = await client().query({ limit: 1 });
      expect(count).toBe(1);
    });

    it("should read stream by name", async () => {
      const { count } = await client().query(
        { names: ["DigitPressed"], limit: 3 },
        (e) => {
          expect(e.name).toBe("DigitPressed");
        }
      );
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("should read stream with after", async () => {
      const { first } = await client().query({ after: 3 });
      expect(first?.id).toBe(4);
    });

    it("should read stream with limit", async () => {
      const { count } = await client().query({ limit: 5 });
      expect(count).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const { first, count } = await client().query({ after: 2, limit: 2 });
      expect(first?.id).toBe(3);
      expect(count).toBe(2);
    });

    it("should read stream with stream name", async () => {
      const { count } = await client().query({
        stream: Calculator(id).stream(),
        limit: 10
      });
      expect(count).toBe(6);
    });

    it("should return an empty stream", async () => {
      const { count } = await client().query({ names: [chance.guid()] });
      expect(count).toBe(0);
    });

    it("should read stream with before and after", async () => {
      const { last, count } = await client().query({
        after: 2,
        before: 4,
        limit: 5
      });
      expect(last?.id).toBe(3);
      expect(count).toBe(1);
    });

    it("should read stream with before and after created", async () => {
      const { first, count } = await client().query({
        stream: Calculator(id).stream(),
        created_after,
        created_before,
        limit: 10
      });
      expect(first?.version).toBe(2);
      expect(count).toBe(2);
    });
  });

  describe("misc", () => {
    const createEvent = <E extends Messages>(
      name: keyof E & string,
      stream: string,
      data: E[keyof E & string]
    ): CommittedEvent<E> => ({
      id: 0,
      stream,
      version: 0,
      created: new Date(),
      name,
      data,
      metadata: { correlation: "", causation: {} }
    });

    it("should cover empty calculator", async () => {
      const id = chance.guid();
      const test8 = Calculator(id);
      await client().event(
        Counter,
        createEvent("DigitPressed", test8.stream(), { digit: "0" })
      );
      const { state } = await client().load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should cover initialized log", () => {
      expect(log()).toBeDefined();
    });

    it("should cover ignored handler", async () => {
      const r1 = await client().event(
        IgnoredHandler,
        createEvent("Ignored1", "ignored", {})
      );
      const r2 = await client().event(
        IgnoredHandler,
        createEvent("Ignored2", "ignored", {})
      );
      expect(r1.command).toBeUndefined();
      expect(r2.state).toBeUndefined();
    });

    it("should get store stats", async () => {
      const stats = await store().stats();
      expect(stats).toBeDefined();
    });

    it("should throw invalid command error", async () => {
      await expect(
        client().command(Calculator, "ForgetX" as keyof CalculatorCommands, {})
      ).rejects.toThrow();
    });
  });
});
