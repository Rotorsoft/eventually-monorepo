process.env.LOG_LEVEL = "trace";
process.env.NODE_ENV = "production";

import {
  app,
  bind,
  command,
  dispose,
  formatTime,
  load,
  log
} from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Chance } from "chance";

const chance = new Chance();

app().with(Calculator).build();

describe("trace in production", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await command(bind("PressKey", { key: "1" }, id));

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "1",
        result: 0
      });
    });

    it("should log plain error", () => {
      try {
        throw Error("test");
      } catch (error) {
        log().error(error);
      }
      expect(1).toBe(1);
    });

    it("should trace in plain mode", async () => {
      const id = chance.guid();

      await command(bind("PressKey", { key: "1" }, id));

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "1",
        result: 0
      });
    });

    it("should display elapsed time", () => {
      const et1 = formatTime(process.uptime());
      expect(et1.length).toBe(5);
      const et2 = formatTime(process.uptime() + 2 * 60 * 60);
      expect(et2.length).toBe(8);
      const et3 = formatTime(process.uptime() + 25 * 60 * 60);
      expect(et3.length).toBeGreaterThan(8);
    });
  });
});
