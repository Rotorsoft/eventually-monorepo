import { EvtOf, Payload, Policy } from "..";
import { InMemoryApp, InMemoryBroker } from "../__dev__";

const app = new InMemoryApp();
const broker = InMemoryBroker(app);
const factory = (): Policy<{ test: string }, { test: string }, Payload> => ({
  onTest: () => undefined,
  reducer: undefined
});

const event: EvtOf<{ test: string }> = {
  id: 0,
  stream: "",
  version: 0,
  created: new Date(),
  name: "test"
};

describe("InMemoryBroker", () => {
  it("should raise topic not found error on emit", async () => {
    await expect(broker.publish(event)).rejects.toThrow();
  });

  it("should raise topic not found error on subscribe", () => {
    expect(() => broker.subscribe(factory, event)).toThrow();
  });
});
