process.env.LOG_LEVEL = "trace";

import { app, client, dispose, log } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Chance } from "chance";

const chance = new Chance();

app().with(Calculator).build();

describe("cover LOG_LEVEL=trace in production", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should cover trace", async () => {
    const id = chance.guid();
    await client().command(Calculator, "PressKey", { key: "1" }, { id });
    const { state } = await client().load(Calculator, id);
    expect(state).toEqual({
      left: "1",
      result: 0
    });
  });

  it("should cover plain error", () => {
    try {
      throw Error("test");
    } catch (error) {
      log().error(error);
    }
    expect(1).toBe(1);
  });
});
