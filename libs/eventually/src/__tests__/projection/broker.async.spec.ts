import { InMemoryBroker } from "../../adapters";
import { app, client } from "../../ports";
import { dispose } from "../../port";
import { MatchProjector } from "./Match.projector";
import { MatchSystem } from "./Match.system";

describe("async broker", () => {
  const broker = InMemoryBroker(1000, 10);

  beforeAll(async () => {
    app().with(MatchSystem).with(MatchProjector).build();
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    const id = 1;
    await client().command(
      MatchSystem,
      "CreateCustomer",
      {
        id,
        name: "testing name"
      },
      { stream: "test" }
    );
    await client().command(
      MatchSystem,
      "ChangeCustomerName",
      {
        id,
        name: "changed the name"
      },
      { stream: "test" }
    );
    //await client().query({ limit: 5 }, (e) => log().events([e]));
    await broker.drain();
    let p = { watermark: 0 };
    await client().read(MatchProjector, "MatchSystem", (r) => (p = r));
    expect(p).toBeDefined();
    expect(p.watermark).toBe(1);
    await broker.dispose();
  });
});
