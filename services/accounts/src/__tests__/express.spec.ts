import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { system } from "@rotorsoft/eventually-test";
import { Server } from "http";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

app(new ExpressApp())
  .withCommands(commands.factory)
  .withEvents(events.factory)
  .withPolicies(
    policies.IntegrateAccount1,
    policies.IntegrateAccount2,
    policies.IntegrateAccount3,
    policies.WaitForAllAndComplete
  )
  .withSystems(
    systems.ExternalSystem1,
    systems.ExternalSystem2,
    systems.ExternalSystem3,
    systems.ExternalSystem4
  );

let server: Server;
const port = 3005;

describe("express", () => {
  beforeAll(async () => {
    const express = app().build();
    await (app() as ExpressApp).listen(true);
    server = (express as any).listen(port, () => {
      return;
    });
  });

  afterAll(async () => {
    (server as unknown as Server).close();
    await app().close();
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
