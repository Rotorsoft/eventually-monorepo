import { client, projector, app, dispose } from "../../.";
import { MatchProjection, MatchProjector } from "./Match.projector";
import { steps, trace } from "./steps";

describe("match projection", () => {
  beforeAll(() => {
    app().with(MatchProjector).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  test("should work", async () => {
    for (const step of steps) {
      await client().project(MatchProjector, step.event);
      const p = await projector().load<MatchProjection>([step.event.stream]);
      expect(p[step.event.stream].state).toEqual(step.state);
      await trace();
    }
  });
});
