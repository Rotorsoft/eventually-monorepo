jest.mock("../accounts.systems.ts", () => {
  const originalModule = jest.requireActual("../accounts.systems.ts");
  return {
    __esModule: true,
    ...originalModule,
    ExternalSystem4: jest.fn().mockImplementation(() => {
      return {
        stream: () => "ExternalSystem4",
        onCompleteIntegration: () => {
          return Promise.reject(new Error("error completing integration"));
        }
      };
    })
  };
});

import { app, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { sleep } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import * as schemas from "../accounts.schemas";

const chance = new Chance();

store(PostgresStore("sad".concat(chance.guid()).replace(/-/g, "")));

app()
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
  .withPrivate<events.Events>(
    "Account1Created",
    "Account2Created",
    "Account3Created",
    "AccountCreated"
  )
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
  )
  .build();

const trigger = (id: string): any => ({
  id: 1,
  version: 1,
  stream: "main",
  created: new Date(),
  name: "AccountCreated",
  data: { id }
});

describe("sad path", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw and not commit anything", async () => {
    const t = trigger(chance.guid());

    await app().event(policies.IntegrateAccount1, t);
    await sleep(100);

    const spyCommit = jest.spyOn(store(), "commit");
    await expect(app().event(policies.IntegrateAccount2, t)).rejects.toThrow(
      "error completing integration"
    );

    // expect nothing committed
    expect(spyCommit).toHaveBeenCalledTimes(2);
    const sys2 = (
      await app().query({
        stream: systems.ExternalSystem2().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    const sys3 = (
      await app().query({
        stream: systems.ExternalSystem3().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    const sys4 = (
      await app().query({
        stream: systems.ExternalSystem4().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    expect(sys2.length).toBe(0);
    expect(sys3.length).toBe(0);
    expect(sys4.length).toBe(0);
  });
});
