import { app, InMemoryBroker, InMemoryStore } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { command } from "@rotorsoft/eventually-test";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

app(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregates(Calculator);
const store = InMemoryStore();
const broker = InMemoryBroker(app());
let server: Server;

jest.spyOn(broker, "publish").mockRejectedValue("publish error");
const logerror = jest.spyOn(app().log, "error");

describe("express app", () => {
  beforeAll(async () => {
    const express = (app() as ExpressApp).build({ store, broker });
    await (app() as ExpressApp).listen(true);
    server = express.listen(3002, () => {
      return;
    });
  });

  afterAll(async () => {
    server.close();
    await app().close();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
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
