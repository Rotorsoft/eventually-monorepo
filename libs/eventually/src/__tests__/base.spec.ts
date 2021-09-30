import { Policy } from "..";
import { InMemoryApp, InMemoryBroker } from "../__dev__";

const app = new InMemoryApp();
const broker = InMemoryBroker(app);
const policy: Policy<{ test: string }, { test: string }> = {
  onTest: () => undefined
};
const event = {
  eventId: 0,
  aggregateId: "",
  aggregateVersion: "",
  createdAt: new Date(),
  name: "test"
};

describe("InMemoryBroker", () => {
  it("should raise topic not found error on emit", async () => {
    await expect(broker.emit(event)).rejects.toThrow();
  });

  it("should raise topic not found error on subscribe", () => {
    expect(() => broker.subscribe(policy, event)).toThrow();
  });
});
