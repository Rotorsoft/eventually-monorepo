//process.env.LOG_LEVEL = "trace";

import {
  app,
  event,
  CommittedEvent,
  dispose,
  query,
  store
} from "@rotorsoft/eventually";
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

    await event(policies.IntegrateAccount1, t);

    const spyCommit = jest.spyOn(store(), "commit");
    await expect(event(policies.IntegrateAccount2, t)).rejects.toThrow(
      "error completing integration"
    );
    expect(spyCommit).toHaveBeenCalledTimes(2);

    const sys2 = await query(
      {
        stream: systems.ExternalSystem2().stream()
      },
      () => {
        return;
      }
    );
    const sys3 = await query(
      {
        stream: systems.ExternalSystem3().stream()
      },
      () => {
        return;
      }
    );
    const sys4 = await query(
      {
        stream: systems.ExternalSystem4().stream()
      },
      () => {
        return;
      }
    );

    expect(sys2).toBe(0);
    expect(sys3).toBe(0);
    expect(sys4).toBe(0);
  });
});
