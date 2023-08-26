import { InMemoryBroker } from "../../adapters";
import { app, broker, client, log } from "../../ports";
import { dispose } from "../../port";
import { MatchProjector } from "./Match.projector";
import { MatchSystem } from "./Match.system";

describe("async broker", () => {
  beforeAll(async () => {
    app().with(MatchSystem).with(MatchProjector).build();
    broker(InMemoryBroker({ timeout: 1000, limit: 10, delay: 500 }));
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    await client().command(
      MatchSystem,
      "CreateCustomer",
      {
        id: 1,
        name: "testing name"
      },
      { stream: "test" }
    );
    await client().command(
      MatchSystem,
      "ChangeCustomerName",
      {
        id: 1,
        name: "changed the name"
      },
      { stream: "test" }
    );
    await client().command(
      MatchSystem,
      "CreateCustomer",
      {
        id: 2,
        name: "testing name"
      },
      { stream: "test" }
    );
    await client().query({ limit: 5 }, (e) => log().events([e]));

    await broker().drain();
    const records = await client().read(MatchProjector, "MatchSystem");
    expect(records.at(0)?.watermark).toBe(2);
  });
});
