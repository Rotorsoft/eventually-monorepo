import { app, broker, client, dispose, Scope } from "@rotorsoft/eventually";
import { Chance } from "chance";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import * as schemas from "../accounts.schemas";
import { trigger } from "./trigger";

const chance = new Chance();

app()
  .with(policies.IntegrateAccount1)
  .with(policies.IntegrateAccount2)
  .with(policies.IntegrateAccount3)
  .with(policies.WaitForAllAndComplete, { scope: Scope.private })
  .with(systems.ExternalSystem1)
  .with(systems.ExternalSystem2)
  .with(systems.ExternalSystem3)
  .with(systems.ExternalSystem4)
  .build();

describe("account integration flows", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should complete integration 1-2", async () => {
    const t = trigger(chance.guid());

    await client().event(policies.IntegrateAccount1, t);
    await broker().drain();
    await client().event(policies.IntegrateAccount2, t);
    await broker().drain();

    const states: schemas.WaitForAllState[] = [];
    await client().load(
      policies.WaitForAllAndComplete,
      "WaitForAllAndComplete",
      false,
      ({ state }) => state[t.data.id] && states.push(state[t.data.id])
    );

    expect(states[0].account1).toBeDefined();
    expect(states[0].account3).not.toBeDefined();
    expect(states[1].account1).toBeDefined();
    expect(states[1].account3).toBeDefined();
  });

  it("should complete integration 2-1", async () => {
    const t = trigger(chance.guid());

    await client().event(policies.IntegrateAccount2, t);
    await broker().drain();
    await client().event(policies.IntegrateAccount1, t);
    await broker().drain();

    const states: schemas.WaitForAllState[] = [];
    await client().load(
      policies.WaitForAllAndComplete,
      "WaitForAllAndComplete",
      false,
      ({ state }) => state[t.data.id] && states.push(state[t.data.id])
    );

    expect(states[0].account3).toBeDefined();
    expect(states[0].account1).not.toBeDefined();
    expect(states[1].account1).toBeDefined();
    expect(states[1].account3).toBeDefined();

    // expect flow events
    let sys2 = -1,
      sys3 = -1,
      sys4 = -1;
    await client().query(
      {
        stream: systems.ExternalSystem2().stream
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys2 = e.id;
      }
    );
    await client().query(
      {
        stream: systems.ExternalSystem3().stream
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys3 = e.id;
      }
    );
    await client().query(
      {
        stream: systems.ExternalSystem4().stream
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys4 = e.id;
      }
    );

    expect(sys2).toBeLessThan(sys3);
    expect(sys3).toBeLessThan(sys4);
  });
});
