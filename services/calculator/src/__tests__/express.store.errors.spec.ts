import { App, InMemoryBroker, InMemoryStore } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { get } from "./http";

const app = App(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator);
const store = InMemoryStore();
const broker = InMemoryBroker(app);
const express = app.build({ store, broker });
const server = express.listen(3001, () => {
  return;
});

jest.spyOn(store, "read").mockRejectedValue("Error");
jest.spyOn(store, "load").mockRejectedValue("Error");

describe("express app", () => {
  beforeAll(async () => {
    await app.listen(true);
  });

  afterAll(async () => {
    (server as unknown as Server).close();
    await app.close();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
      await expect(get("/stream", 3001)).rejects.toThrowError("500");
    });

    it("should throw internal error on aggregate", async () => {
      await expect(get("/calculator/test", 3001)).rejects.toThrowError("500");
    });
  });
});
