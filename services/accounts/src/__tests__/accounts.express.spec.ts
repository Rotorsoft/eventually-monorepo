import { app, dispose, Scope } from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

const chance = new Chance();

const expressApp = app(new ExpressApp())
  .with(policies.IntegrateAccount1)
  .with(policies.IntegrateAccount2)
  .with(policies.IntegrateAccount3)
  .with(policies.WaitForAllAndComplete)
  .with(systems.ExternalSystem2, { scope: Scope.public })
  .with(systems.ExternalSystem3, { scope: Scope.public })
  .with(systems.ExternalSystem4, { scope: Scope.public })
  .with(systems.ExternalSystem1, { scope: Scope.public });

const port = 3005;
const http = HttpClient(port);

describe("express", () => {
  beforeAll(async () => {
    expressApp.build();
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should complete command", async () => {
    const [result] = await http.command(
      systems.ExternalSystem1,
      "CreateAccount1",
      { id: chance.guid() }
    );

    expect(result?.event?.name).toBe("Account1Created");
    expect(result?.event?.stream).toBe("ExternalSystem1");
  });

  it("should throw validation error", async () => {
    await expect(
      http.command(systems.ExternalSystem1, "CreateAccount1", { id: "" })
    ).rejects.toThrow("Request failed with status code 400");
  });
});
