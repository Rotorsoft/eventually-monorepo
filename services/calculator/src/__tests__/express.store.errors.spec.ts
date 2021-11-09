import { app, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { get } from "@rotorsoft/eventually-test";
import { Server } from "http";
import { Calculator } from "../calculator.aggregate";
import * as schemas from "../calculator.schemas";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";

app(new ExpressApp())
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator);

let server: Server;

jest.spyOn(store(), "query").mockRejectedValue("Error");

describe("express app", () => {
  beforeAll(async () => {
    const express = (app() as ExpressApp).build();
    await (app() as ExpressApp).listen(true);
    server = express.listen(3001, () => {
      return;
    });
  });

  afterAll(async () => {
    server.close();
    await app().close();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
      await expect(get("/all", 3001)).rejects.toThrowError("500");
    });

    it("should throw internal error on aggregate", async () => {
      await expect(get("/calculator/test", 3001)).rejects.toThrowError("500");
    });
  });
});
