import { app, InMemoryBroker, InMemoryStore } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { get } from "@rotorsoft/eventually-test";
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

jest.spyOn(store, "read").mockRejectedValue("Error");

describe("express app", () => {
  beforeAll(async () => {
    const express = (app() as ExpressApp).build({ store, broker });
    await (app() as ExpressApp).listen(true);
    server = express.listen(3001, () => {
      return;
    });
  });

  afterAll(async () => {
    (server as unknown as Server).close();
    await app().close();
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
