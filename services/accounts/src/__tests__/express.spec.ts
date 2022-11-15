import { app, bind, dispose } from "@rotorsoft/eventually";
import { ExpressApp, tester } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import * as schemas from "../accounts.schemas";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

const chance = new Chance();

const expressApp = app(new ExpressApp())
  .withSchemas<commands.Commands>({
    CreateAccount1: schemas.CreateAccount1,
    CreateAccount2: schemas.CreateAccount2,
    CreateAccount3: schemas.CreateAccount3,
    CompleteIntegration: schemas.CompleteIntegration
  })
  .withSchemas<events.Events>({
    AccountCreated: schemas.AccountCreated,
    Account1Created: schemas.Account1Created,
    Account2Created: schemas.Account2Created,
    Account3Created: schemas.Account3Created,
    IntegrationCompleted: schemas.IntegrationCompleted
  })
  .withPolicy(policies.IntegrateAccount1)
  .withPolicy(policies.IntegrateAccount2)
  .withPolicy(policies.IntegrateAccount3)
  .withProcessManager(policies.WaitForAllAndComplete)
  .withExternalSystem(systems.ExternalSystem2)
  .withExternalSystem(systems.ExternalSystem3)
  .withExternalSystem(systems.ExternalSystem4)
  .withExternalSystem(systems.ExternalSystem1, "ext1");

const port = 3005;
const t = tester(port);

describe("express", () => {
  beforeAll(async () => {
    expressApp.build();
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should complete command", async () => {
    // when
    const [result] = await t.command(
      systems.ExternalSystem1,
      bind("CreateAccount1", { id: chance.guid() })
    );

    // then
    expect(result?.event?.name).toBe("Account1Created");
    expect(result?.event?.stream).toBe("ExternalSystem1");
  });

  it("should throw validation error", async () => {
    await expect(
      t.command(systems.ExternalSystem1, bind("CreateAccount1", { id: "" }))
    ).rejects.toThrowError("Request failed with status code 400");
  });
});
