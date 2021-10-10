import { app, broker, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { command, sleep } from "@rotorsoft/eventually-test";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

store(PostgresStore("calculator"));
const _broker = broker();
jest.spyOn(_broker, "publish").mockRejectedValue("publish error");

const _app = app(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregates(Calculator) as ExpressApp;
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
      await sleep(1);
      await expect(
        command(
          Calculator,
          "test5",
          commands.PressKey({ key: "1" }),
          undefined,
          3002
        )
      ).rejects.toThrow("Request failed with status code 500");
      expect(logerror).toHaveBeenCalledWith("publish error");
    });
  });
});
