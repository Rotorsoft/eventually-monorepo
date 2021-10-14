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

import { app, EvtOf, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { Chance } from "chance";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

const chance = new Chance();

store(PostgresStore("sad".concat(chance.guid()).replace(/-/g, "")));

app()
  .withCommands(commands.factory)
  .withEvents(events.factory)
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

const trigger = (id: string): EvtOf<Pick<events.Events, "AccountCreated">> => {
  return {
    id: 1,
    version: 1,
    stream: "main",
    created: new Date(),
    name: "AccountCreated",
    data: { id },
    scope: () => "public",
    schema: events.factory.AccountCreated().schema
  } as EvtOf<Pick<events.Events, "AccountCreated">>;
};

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
    await expect(app().event(policies.IntegrateAccount2, t)).rejects.toThrow(
      "error completing integration"
    );

    // expect nothing committed
    const sys2 = (
      await app().read({
        stream: systems.ExternalSystem2().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    const sys3 = (
      await app().read({
        stream: systems.ExternalSystem3().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    const sys4 = (
      await app().read({
        stream: systems.ExternalSystem4().stream()
      })
    ).filter((e) => e.data.id === t.data.id);
    expect(sys2.length).toBe(0);
    expect(sys3.length).toBe(0);
    expect(sys4.length).toBe(0);
  });
});
