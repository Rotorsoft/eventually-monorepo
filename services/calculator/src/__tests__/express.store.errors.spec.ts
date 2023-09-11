import {
  app,
  dispose,
  store,
  subscriptions,
  ValidationError
} from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { HttpClient } from "@rotorsoft/eventually-openapi";
import { Calculator } from "@rotorsoft/calculator-artifacts";

const port = 4002;
const http = HttpClient(port);

const exapp = app(new ExpressApp()).with(Calculator);

jest.spyOn(store(), "query").mockRejectedValue(new Error("store query error"));
jest.spyOn(store(), "stats").mockRejectedValue(new Error("store stats error"));
jest
  .spyOn(subscriptions(), "subscriptions")
  .mockRejectedValue(new Error("store subs error"));

describe("calculator express app with store errors", () => {
  beforeAll(async () => {
    exapp.build({
      middleware: [
        (req, _, next) => {
          if (req.path === "/query")
            throw new ValidationError(["express query error"]);
          next();
        }
      ]
    });
    await exapp.listen(port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should throw internal error on stream", async () => {
    await expect(http.get("/all")).rejects.toThrow();
  });

  it("should throw internal error on aggregate", async () => {
    await expect(http.get("/calculator/test")).rejects.toThrow("500");
  });

  it("should throw internal error on stats", async () => {
    await expect(http.get("/_stats")).rejects.toThrow("500");
  });

  it("should throw internal error on subscriptions", async () => {
    await expect(http.get("/_subscriptions")).rejects.toThrow("500");
  });

  it("should throw validation error", async () => {
    await expect(http.get("/query")).rejects.toThrow("400");
  });
});
