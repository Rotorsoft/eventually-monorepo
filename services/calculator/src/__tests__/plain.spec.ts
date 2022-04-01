process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "trace";

import { app, bind, dispose, formatTime } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import * as schemas from "../calculator.schemas";
import { Chance } from "chance";

const chance = new Chance();

app()
  .withCommandHandlers(Calculator)
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .build();

describe("trace in prod mode", () => {
  beforeAll(() => {
    app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("calculator", () => {
    it("should trace in plain mode", async () => {
      const id = chance.guid();

      await app().command(bind("PressKey", { key: "1" }, id));

      const { state } = await app().load(Calculator(id));
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
