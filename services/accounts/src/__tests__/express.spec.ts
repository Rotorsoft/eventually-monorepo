import { App } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import { command } from "./http";

App(new ExpressApp())
  .withCommands(commands.factory)
  .withEvents(events.factory)
  .withPolicy(policies.IntegrateAccount1)
  .withPolicy(policies.IntegrateAccount2)
  .withPolicy(policies.IntegrateAccount3)
  .withPolicy(policies.WaitForAllAndComplete)
  .withExternalSystem(systems.ExternalSystem1)
  .withExternalSystem(systems.ExternalSystem2)
  .withExternalSystem(systems.ExternalSystem3)
  .withExternalSystem(systems.ExternalSystem4)
  .build();

describe("express", () => {
  beforeAll(async () => {
    await App().listen();
  });

  it("should complete command", async () => {
    // when
    const [result] = await command(
      systems.ExternalSystem1,
      commands.factory.CreateAccount1({ id: "test" })
    );

    // then
    expect(result.event.name).toBe("Account1Created");
    expect(result.event.stream).toBe("ExternalSystem1");
  });

  it("should throw validation error", async () => {
    await expect(
      command(systems.ExternalSystem1, {
        name: "CreateAccount1",
        schema: () => undefined
      })
    ).rejects.toThrowError("Request failed with status code 400");
  });
});
