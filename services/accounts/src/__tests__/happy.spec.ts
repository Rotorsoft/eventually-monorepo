import { App, EvtOf } from "@rotorsoft/eventually";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import { sleep } from "./http";

App()
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

const trigger = (id: string): EvtOf<Pick<events.Events, "AccountCreated">> => {
  return {
    id: 1,
    version: 1,
    stream: "main",
    created: new Date(),
    name: "AccountCreated",
    data: { id },
    schema: events.factory.AccountCreated().schema
  } as EvtOf<Pick<events.Events, "AccountCreated">>;
};

describe("happy path", () => {
  beforeAll(async () => {
    await App().listen();
  });

  it("should complete integration 1-2", async () => {
    const t = trigger("account12");

    // given
    await App().event(policies.IntegrateAccount1, t);
    await sleep(100);

    // when
    await App().event(policies.IntegrateAccount2, t);
    await sleep(100);

    // then
    const [seed] = await App().read("Account1Created");
    const snapshots = await App().stream(
      policies.WaitForAllAndComplete(
        seed as EvtOf<Pick<events.Events, "Account1Created">>
      ).reducer
    );
    expect(snapshots.length).toBe(2);
    expect(snapshots[0].state.id).toBe(t.data.id);
    expect(snapshots[1].state.id).toBe(t.data.id);
    expect(snapshots[0].state.account1).toBeDefined();
    expect(snapshots[0].state.account3).not.toBeDefined();
    expect(snapshots[1].state.account1).toBeDefined();
    expect(snapshots[1].state.account3).toBeDefined();
  });

  it("should complete integration 2-1", async () => {
    const t = trigger("account21");

    // given
    await App().event(policies.IntegrateAccount2, t);
    await sleep(100);

    // when
    await App().event(policies.IntegrateAccount1, t);
    await sleep(100);

    // then
    const [seed] = (await App().read("Account1Created", -1, 100)).filter(
      (e) => e.data.id === t.data.id
    );
    const snapshots = await App().stream(
      policies.WaitForAllAndComplete(
        seed as EvtOf<Pick<events.Events, "Account1Created">>
      ).reducer
    );
    expect(snapshots.length).toBe(2);
    expect(snapshots[0].state.id).toBe(t.data.id);
    expect(snapshots[1].state.id).toBe(t.data.id);
    expect(snapshots[0].state.account3).toBeDefined();
    expect(snapshots[0].state.account1).not.toBeDefined();
    expect(snapshots[1].state.account1).toBeDefined();
    expect(snapshots[1].state.account3).toBeDefined();
  });
});
