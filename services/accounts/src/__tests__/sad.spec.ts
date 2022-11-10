//process.env.LOG_LEVEL = "trace";

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

import { app, CommittedEvent, dispose, store } from "@rotorsoft/eventually";
import { Chance } from "chance";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import * as schemas from "../accounts.schemas";
import { Events } from "../accounts.events";

const chance = new Chance();

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
  .withEventHandlers(
    policies.IntegrateAccount1,
    policies.IntegrateAccount2,
    policies.IntegrateAccount3
  )
  .withProcessManager(policies.WaitForAllAndComplete)
  .withCommandHandlers(
    systems.ExternalSystem1,
    systems.ExternalSystem2,
    systems.ExternalSystem3,
    systems.ExternalSystem4
  )
  .build();

const trigger = (
  id: string
): CommittedEvent<Pick<Events, "AccountCreated">> => ({
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
    await dispose()();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw and not commit anything", async () => {
    const t = trigger(chance.guid());

    await app().event(policies.IntegrateAccount1, t);

    const spyCommit = jest.spyOn(store(), "commit");
    await expect(app().event(policies.IntegrateAccount2, t)).rejects.toThrow(
      "error completing integration"
    );

    expect(spyCommit).toHaveBeenCalledTimes(2);
    const sys2 = (
      (await app().query({
        stream: systems.ExternalSystem2().stream()
      })) as CommittedEvent<Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    const sys3 = (
      (await app().query({
        stream: systems.ExternalSystem3().stream()
      })) as CommittedEvent<Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    const sys4 = (
      (await app().query({
        stream: systems.ExternalSystem4().stream()
      })) as CommittedEvent<Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    expect(sys2.length).toBe(1);
    expect(sys3.length).toBe(1);
    expect(sys4.length).toBe(0);
  });
});
