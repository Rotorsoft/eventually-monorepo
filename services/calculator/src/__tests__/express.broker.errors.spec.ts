import { app, bind, broker, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { command } from "@rotorsoft/eventually-test";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import * as schemas from "../calculator.schemas";

store(PostgresStore("calculator"));
const _broker = broker();
jest.spyOn(_broker, "publish").mockRejectedValue("publish error");

const _app = app(new ExpressApp())
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator) as ExpressApp;
let server: Server;

const logerror = jest.spyOn(_app.log, "error");

describe("express app", () => {
  beforeAll(async () => {
    const express = _app.build();
    await _app.listen(true);
    server = express.listen(3002, () => {
      return;
    });
  });

  afterAll(async () => {
    server.close();
    await _app.close();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
      await expect(
        command(Calculator, bind("PressKey", { key: "1" }, "test5"), 3002)
      ).rejects.toThrow("Request failed with status code 500");
      expect(logerror).toHaveBeenCalledWith("publish error");
    });
  });
});
