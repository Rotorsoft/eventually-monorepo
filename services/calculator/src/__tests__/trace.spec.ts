process.env.LOG_LEVEL = "trace";
process.env.NODE_ENV = "production";

import { app, bind, dispose, log } from "@rotorsoft/eventually";
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

describe("trace in test mode", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await app().command(bind("PressKey", { key: "1" }, id));

      const { state } = await app().load(Calculator, id);
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
  });
});
