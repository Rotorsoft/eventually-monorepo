import { app, EvtOf } from "@rotorsoft/eventually";
import * as commands from "../accounts.commands";
import * as events from "../accounts.events";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";

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
    schema: events.factory.AccountCreated().schema
  } as EvtOf<Pick<events.Events, "AccountCreated">>;
};

describe("happy path", () => {
  beforeAll(async () => {
    await app().listen();
  });

  it("should complete integration 1-2", async () => {
    const t = trigger("account12");

    // given
    await app().event(policies.IntegrateAccount1, t);

    // when
    await app().event(policies.IntegrateAccount2, t);

    // then
    const [seed] = await app().read("Account1Created");
    const snapshots = await app().stream(
      policies.WaitForAllAndComplete(
        seed as EvtOf<Pick<events.Events, "Account1Created">>
      )
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
    await app().event(policies.IntegrateAccount2, t);

    // when
    await app().event(policies.IntegrateAccount1, t);

    // then
    const [seed] = (await app().read("Account1Created", -1, 100)).filter(
      (e) => e.data.id === t.data.id
    );
    const snapshots = await app().stream(
      policies.WaitForAllAndComplete(
        seed as EvtOf<Pick<events.Events, "Account1Created">>
      )
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
