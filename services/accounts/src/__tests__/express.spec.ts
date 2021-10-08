import { App } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { command, system } from "@rotorsoft/eventually-test";
import { Server } from "http";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

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
  .withExternalSystem(systems.ExternalSystem4);

let server: Server;
const port = 3005;

describe("express", () => {
  beforeAll(async () => {
    const express = App().build();
    await App().listen(true);
    server = (express as any).listen(port, () => {
      return;
    });
  });

  afterAll(async () => {
    (server as unknown as Server).close();
    await App().close();
  });

  it("should complete command", async () => {
    // when
    const [result] = await system(
      systems.ExternalSystem1,
      commands.factory.CreateAccount1({ id: "test" }),
      port
    );

    // then
    expect(result.event.name).toBe("Account1Created");
    expect(result.event.stream).toBe("ExternalSystem1");
  });

  it("should throw validation error", async () => {
    await expect(
      system(
        systems.ExternalSystem1,
        {
          name: "CreateAccount1",
          schema: () => undefined
        },
        port
      )
    ).rejects.toThrowError("Request failed with status code 400");
  });
});
