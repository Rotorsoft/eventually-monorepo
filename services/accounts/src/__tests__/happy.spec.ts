// process.env.LOG_LEVEL = "trace";

import { app, CommittedEvent, dispose } from "@rotorsoft/eventually";
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

    await app().event(policies.IntegrateAccount1, t);
    await app().event(policies.IntegrateAccount2, t);

    const snapshots = await app().stream(
      policies.WaitForAllAndComplete,
      `WaitForAllAndComplete:${t?.data?.id}`
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

    await app().event(policies.IntegrateAccount2, t);
    await app().event(policies.IntegrateAccount1, t);

    const snapshots = await app().stream(
      policies.WaitForAllAndComplete,
      `WaitForAllAndComplete:${t?.data?.id}`
    );
    expect(snapshots.length).toBe(2);
    expect(snapshots[0]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[1]?.state?.id).toBe(t?.data?.id);
    expect(snapshots[0]?.state?.account3).toBeDefined();
    expect(snapshots[0]?.state?.account1).not.toBeDefined();
    expect(snapshots[1]?.state?.account1).toBeDefined();
    expect(snapshots[1]?.state?.account3).toBeDefined();

    // expect flow events
    const [sys2] = (
      (await app().query({
        stream: systems.ExternalSystem2().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e?.data?.id === t?.data?.id);
    const [sys3] = (
      (await app().query({
        stream: systems.ExternalSystem3().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e?.data?.id === t?.data?.id);
    const [sys4] = (
      (await app().query({
        stream: systems.ExternalSystem4().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e?.data?.id === t?.data?.id);
    expect(sys2.id).toBeLessThan(sys3.id);
    expect(sys3.id).toBeLessThan(sys4.id);
  });
});
