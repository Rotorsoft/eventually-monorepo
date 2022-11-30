import {
  Actor,
  app,
  bind,
  command,
  CommittedEvent,
  dispose,
  event,
  invoke,
  load,
  log,
  Messages,
  query,
  Snapshot,
  store
} from "@rotorsoft/eventually";
import { tester } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import * as schemas from "../calculator.schemas";
import { Calculator, CalculatorModel } from "../calculator.aggregate";
import { Counter, IgnoredHandler } from "../counter.policy";
import { Forget } from "../forget.system";
import { ExternalPayload, PressKeyAdapter } from "../presskey.adapter";
import { InMemorySnapshotStore } from "../../../eventually/src/__dev__";

const chance = new Chance();
const t = tester();
const inMemorySnapshots = InMemorySnapshotStore();

app()
  .with(Forget)
  .with(Calculator)
  .with(IgnoredHandler)
  .with(Counter)
  .with(PressKeyAdapter)
  .withSnapshot(Calculator, { store: inMemorySnapshots, threshold: 2 })
  .build();

const pressKey = (
  id: string,
  key: schemas.Keys
): Promise<Snapshot<CalculatorModel, schemas.AllEvents>[]> =>
  command(bind("PressKey", { key }, id));

const reset = (
  id: string
): Promise<Snapshot<CalculatorModel, schemas.AllEvents>[]> =>
  command(bind("Reset", {}, id));

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
      await invoke(PressKeyAdapter, { id, key: "=" } as ExternalPayload);

      // THEN
      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      // With no Snapshot loading
      let cnt1 = 0;
      await load(Calculator, id, false, () => {
        cnt1++;
      });
      expect(cnt1).toBe(6);

      // With Snapshot loading
      let cnt2 = 0;
      await load(Calculator, id, true, () => {
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
      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      let cnt = 0;
      await load(Calculator, id, false, () => {
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
      await load(Calculator, id, false, () => {
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
      await load(Calculator, id, true, () => {
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
      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should record metadata with actor", async () => {
      const id = chance.guid();
      const actor: Actor = { name: "the-actor", roles: [] };
      const cmd = bind("PressKey", { key: "1" }, id, -1, actor);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, ...cmdmeta } = cmd;

      // WHEN
      await command(cmd);

      // THEN
      const snap = await load(Calculator, id);
      expect(snap?.event?.metadata?.correlation.length).toEqual(24);
      expect(snap?.event?.metadata?.causation.command).toEqual(cmdmeta);
    });

    it("should throw concurrency error", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, "1");

      // WHEN
      await expect(command(bind("PressKey", { key: "1" }, id, -1)))
        // THEN
        .rejects.toThrow();
    });

    it("should throw validation error", async () => {
      await expect(
        command(bind("PressKey", {}, chance.guid()))
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
      const { event, state } = await load(Calculator, id);
      expect(state).toEqual(expect.objectContaining({ result: 0 }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      let cnt = 0;
      await load(Counter, "Counter-".concat(event?.stream || ""), false, () => {
        cnt++;
      });
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
      const { state } = await load(Calculator, id);
      expect(state).toEqual(expect.objectContaining({ result: 0 }));
    });
  });

  describe("all stream", () => {
    const id = chance.guid();
    let created_after: Date, created_before: Date;

    beforeAll(async () => {
      await pressKey(id, "1");
      await pressKey(id, "+");

      await t.sleep(100);
      created_after = new Date();
      await t.sleep(100);

      await pressKey(id, "2");
      await pressKey(id, ".");

      await t.sleep(100);
      created_before = new Date();
      await t.sleep(100);

      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const len = await query({ limit: 1 }, () => {
        return;
      });
      expect(len).toBe(1);
    });

    it("should read stream by name", async () => {
      const len = await query({ names: ["DigitPressed"], limit: 3 }, (e) => {
        expect(e.name).toBe("DigitPressed");
      });
      expect(len).toBeGreaterThanOrEqual(3);
    });

    it("should read stream with after", async () => {
      let first = 0;
      await query({ after: 3 }, (e) => {
        !first && (first = e.id);
      });
      expect(first).toBe(4);
    });

    it("should read stream with limit", async () => {
      const len = await query({ limit: 5 }, () => {
        return;
      });
      expect(len).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      let first = 0;
      const len = await query(
        { after: 2, limit: 2 },
        (e) => !first && (first = e.id)
      );
      expect(first).toBe(3);
      expect(len).toBe(2);
    });

    it("should read stream with stream name", async () => {
      const len = await query(
        { stream: Calculator(id).stream(), limit: 10 },
        () => {
          return;
        }
      );
      expect(len).toBe(6);
    });

    it("should return an empty stream", async () => {
      const len = await query({ names: [chance.guid()] }, () => {
        return;
      });
      expect(len).toBe(0);
    });

    it("should read stream with before and after", async () => {
      let last = 0;
      const len = await query({ after: 2, before: 4, limit: 5 }, (e) => {
        last = e.id;
      });
      expect(last).toBe(3);
      expect(len).toBe(1);
    });

    it("should read stream with before and after created", async () => {
      let first = -1;
      const len = await query(
        {
          stream: Calculator(id).stream(),
          created_after,
          created_before,
          limit: 10
        },
        (e) => {
          first < 0 && (first = e.version);
        }
      );
      expect(first).toBe(2);
      expect(len).toBe(2);
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
      await event(
        Counter,
        createEvent("DigitPressed", test8.stream(), { digit: "0" })
      );
      const { state } = await load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should cover initialized log", () => {
      expect(log()).toBeDefined();
    });

    it("should cover ignored handler", async () => {
      const r1 = await event(
        IgnoredHandler,
        createEvent("Ignored1", "ignored", {})
      );
      const r2 = await event(
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
      await expect(command(bind("Forget2", {}))).rejects.toThrow();
    });

    it("should throw message metadata not found error", async () => {
      const id = chance.guid();
      await command(bind("Whatever", {}, id));
      await expect(command(bind("Forgetx", {}, id))).rejects.toThrow();
    });
  });
});
