import { app, bind, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { command } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Server } from "http";
import * as schemas from "../accounts.schemas";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

const chance = new Chance();

store(PostgresStore("accounts"));

app(new ExpressApp())
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
  .withEventHandlers(
    policies.IntegrateAccount1,
    policies.IntegrateAccount2,
    policies.IntegrateAccount3,
    policies.WaitForAllAndComplete
  )
  .withCommandHandlers(
    systems.ExternalSystem1,
    systems.ExternalSystem2,
    systems.ExternalSystem3,
    systems.ExternalSystem4
  );

let server: Server;
const port = 3005;

describe("express", () => {
  beforeAll(async () => {
    const express = (app() as ExpressApp).build();
    await (app() as ExpressApp).listen(true);
    server = express.listen(port, () => {
      return;
    });
  });

  afterAll(async () => {
    if (server) server.close();
    await app().close();
  });

  it("should complete command", async () => {
    // when
    const [result] = await command(
      systems.ExternalSystem1,
      bind("CreateAccount1", { id: chance.guid() }),
      port
    );

    // then
    expect(result.event.name).toBe("Account1Created");
    expect(result.event.stream).toBe("ExternalSystem1");
  });

  it("should throw validation error", async () => {
    await expect(
      command(systems.ExternalSystem1, bind("CreateAccount1", null), port)
    ).rejects.toThrowError("Request failed with status code 400");
  });
});
