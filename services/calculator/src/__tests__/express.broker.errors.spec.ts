import { App, InMemoryBroker, InMemoryStore } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { command } from "./http";

const app = App(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator);
const store = InMemoryStore();
const broker = InMemoryBroker(app);
let server: Server;

jest.spyOn(broker, "emit").mockRejectedValue("emit error");
const logerror = jest.spyOn(app.log, "error");

describe("express app", () => {
  beforeAll(async () => {
    const express = await app.listen({ store, broker, silent: true });
    server = express.listen(3002, () => {
      return;
    });
  });

  afterAll(async () => {
    server.close();
    await app.close();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
      await command(
        Calculator,
        "test5",
        commands.PressKey({ key: "1" }),
        undefined,
        3002
      );
      expect(logerror).toHaveBeenCalledWith("emit error");
    });
  });
});
