import { app, client, dispose, Scope, store } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { pressKey } from "./messages";

// app setup
const chance = new Chance();
app()
  .with(Calculator, {
    scope: Scope.default,
    commit: (snapshot) => snapshot.stateCount === 0
  })
  .build();

describe("Calculator with commit state", () => {
  beforeAll(async () => {
    await app().listen();
  });
  afterAll(async () => {
    await dispose()();
  });

  beforeEach(async () => {
    await store().dispose();
  });

  it("should compute correctly", async () => {
    const id = chance.guid();
    await pressKey(id, "1");
    await pressKey(id, "+");
    await pressKey(id, "2");
    await pressKey(id, ".");
    await pressKey(id, "3");

    const { applyCount: cnt1, stateCount } = await client().load(
      Calculator,
      id,
      false
    );
    expect(cnt1).toBe(5);
    expect(stateCount).toBe(1);
  });
});
