//process.env.LOG_LEVEL = "trace";

import { app, CommittedEvent, dispose, store } from "@rotorsoft/eventually";
import * as policies from "../accounts.policies";
import * as systems from "../accounts.systems";
import * as schemas from "../accounts.schemas";

app()
  .with(policies.IntegrateAccount1)
  .with(policies.IntegrateAccount2)
  .with(policies.IntegrateAccount3)
  .with(policies.WaitForAllAndComplete)
  .with(systems.ExternalSystem2)
  .with(systems.ExternalSystem3)
  .with(systems.ExternalSystem4)
  .with(systems.ExternalSystem1)
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

describe("sad path", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should throw and not commit anything", async () => {
    const t = trigger("crash-it");

    await app().event(policies.IntegrateAccount1, t);

    const spyCommit = jest.spyOn(store(), "commit");
    await expect(app().event(policies.IntegrateAccount2, t)).rejects.toThrow(
      "error completing integration"
    );

    expect(spyCommit).toHaveBeenCalledTimes(2);
    const sys2 = (
      (await app().query({
        stream: systems.ExternalSystem2().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    const sys3 = (
      (await app().query({
        stream: systems.ExternalSystem3().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    const sys4 = (
      (await app().query({
        stream: systems.ExternalSystem4().stream()
      })) as CommittedEvent<schemas.Events>[]
    ).filter((e) => e.data?.id === t.data?.id);
    expect(sys2.length).toBe(1);
    expect(sys3.length).toBe(1);
    expect(sys4.length).toBe(0);
  });
});
