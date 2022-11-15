process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "trace";

import joi from "joi";
import { app, bind, dispose, formatTime } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Chance } from "chance";

type TestMsg = {
  date: Date;
};
const TestSchema = joi.object<TestMsg>({
  date: joi.date().required()
});

const chance = new Chance();

app().withAggregate(Calculator).build();

describe("trace in prod mode", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("calculator", () => {
    it("should trace in plain mode", async () => {
      const id = chance.guid();

      await app().command(bind("PressKey", { key: "1" }, id));

      const { state } = await app().load(Calculator, id);
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

    it("should validate and convert date", () => {
      const date = new Date();
      const msg = { date: date.toISOString() };
      const { value } = TestSchema.validate(msg);
      expect(value?.date).toEqual(date);
    });
  });
});
