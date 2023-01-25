import { InMemoryAsyncBroker } from "../../adapters";
import { app, client } from "../../ports";
import { dispose } from "../../singleton";
import { sleep } from "../../utils";
import { MatchProjector } from "./Match.projector";
import { MatchSystem } from "./Match.system";

describe("async broker", () => {
  const broker = InMemoryAsyncBroker(5000, 100, 5);

  beforeAll(async () => {
    app().with(MatchSystem).with(MatchProjector).build();
    await app().listen();
    await broker.poll();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    const id = 1;
    await client().command(MatchSystem, "CreateCustomer", {
      id,
      name: "testing name"
    });
    await client().command(MatchSystem, "ChangeCustomerName", {
      id,
      name: "changed the name"
    });
    //await client().query({ limit: 5 }, (e) => log().events([e]));
    await sleep(1000);
    await broker.poll();
    await sleep(1000);
    const p = await client().read(MatchProjector, ["MatchSystem"]);
    expect(p["MatchSystem"]).toBeDefined();
    expect(p["MatchSystem"].watermark).toBe(1);
    await broker.dispose();
  });
});
