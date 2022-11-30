// process.env.LOG_LEVEL = "trace";

import {
  app,
  CommittedEvent,
  event,
  dispose,
  query,
  load,
  Snapshot
} from "@rotorsoft/eventually";
import { Chance } from "chance";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import * as schemas from "../accounts.schemas";

const chance = new Chance();

app()
  .with(policies.IntegrateAccount1)
  .with(policies.IntegrateAccount2)
  .with(policies.IntegrateAccount3)
  .with(policies.WaitForAllAndComplete)
  .with(systems.ExternalSystem1)
  .with(systems.ExternalSystem2)
  .with(systems.ExternalSystem3)
  .with(systems.ExternalSystem4)
  .build();

const trigger = (
  id: string
): CommittedEvent<Pick<schemas.Events, "AccountCreated">> => ({
  id: 1,
  version: 1,
  stream: "main",
  created: new Date(),
  name: "AccountCreated",
  data: { id },
  metadata: { correlation: "", causation: {} }
});

describe("happy path", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should complete integration 1-2", async () => {
    const t = trigger(chance.guid());

    await event(policies.IntegrateAccount1, t);
    await event(policies.IntegrateAccount2, t);

    const snapshots = [] as Snapshot[];
    await load(
      policies.WaitForAllAndComplete,
      `WaitForAllAndComplete:${t?.data?.id}`,
      false,
      (s) => snapshots.push(s)
    );
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[1]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[0]?.state?.account1).toBeDefined();
    expect(snapshots[0]?.state?.account3).not.toBeDefined();
    expect(snapshots[1]?.state?.account1).toBeDefined();
    expect(snapshots[1]?.state?.account3).toBeDefined();
  });

  it("should complete integration 2-1", async () => {
    const t = trigger(chance.guid());

    await event(policies.IntegrateAccount2, t);
    await event(policies.IntegrateAccount1, t);

    const snapshots = [] as Snapshot[];
    await load(
      policies.WaitForAllAndComplete,
      `WaitForAllAndComplete:${t?.data?.id}`,
      false,
      (s) => snapshots.push(s)
    );
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[1]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[0]?.state?.account3).toBeDefined();
    expect(snapshots[0]?.state?.account1).not.toBeDefined();
    expect(snapshots[1]?.state?.account1).toBeDefined();
    expect(snapshots[1]?.state?.account3).toBeDefined();

    // expect flow events
    let sys2 = -1,
      sys3 = -1,
      sys4 = -1;
    await query(
      {
        stream: systems.ExternalSystem2().stream()
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys2 = e.id;
      }
    );
    await query(
      {
        stream: systems.ExternalSystem3().stream()
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys3 = e.id;
      }
    );
    await query(
      {
        stream: systems.ExternalSystem4().stream()
      },
      (e) => {
        if (e?.data?.id === t?.data?.id) sys4 = e.id;
      }
    );

    expect(sys2).toBeLessThan(sys3);
    expect(sys3).toBeLessThan(sys4);
  });
});
