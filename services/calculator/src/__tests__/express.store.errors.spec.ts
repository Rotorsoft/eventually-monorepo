import { app, dispose, store, ValidationError } from "@rotorsoft/eventually";
import { ExpressApp, tester } from "@rotorsoft/eventually-express";
import * as joi from "joi";
import { Calculator } from "../calculator.aggregate";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import * as schemas from "../calculator.schemas";

const port = 4002;
const t = tester(port);

const exapp = app(new ExpressApp())
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator);

jest.spyOn(store(), "query").mockRejectedValue("Error");
jest.spyOn(store(), "stats").mockRejectedValue("Error");

describe("express app", () => {
  beforeAll(async () => {
    const express = exapp.build();
    express.get("/query", (req, res) => {
      const { error } = joi
        .object({ test: joi.string().required() })
        .required()
        .validate({});
      if (error) throw new ValidationError(error);
      res.send("Query results");
    });
    await exapp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("errors", () => {
    it("should throw internal error on stream", async () => {
      await expect(t.get("/all")).rejects.toThrowError("500");
    });

    it("should throw internal error on aggregate", async () => {
      await expect(t.get("/calculator/test")).rejects.toThrowError("500");
    });

    it("should throw internal error on stats", async () => {
      await expect(t.get("/stats")).rejects.toThrowError("500");
    });

    it("should throw validation error", async () => {
      await expect(t.get("/query")).rejects.toThrowError("400");
    });
  });
});
