import { breaker } from "../utils/breaker";

describe("breaker", () => {
  it("should green light", async () => {
    const good = breaker("good");
    await good.exec<boolean>(() => Promise.resolve({ data: true }));
    expect(good.state()).toBe("green");
  });

  it("should red light", async () => {
    const bad = breaker("bad");
    await bad.exec<boolean>(() => Promise.resolve({ error: "error" }));
    await bad.exec<boolean>(() => Promise.resolve({ error: "error" }));
    await bad.exec<boolean>(() => Promise.resolve({ error: "error" }));
    expect(bad.state()).toBe("red");
    await bad.exec<boolean>(() => Promise.resolve({ error: "error" }));
    expect(bad.state()).toBe("red");
  });

  it("should red light 2", async () => {
    const bad = breaker("bad");
    await bad.exec<boolean>(() => {
      throw Error("error");
    });
    await bad.exec<boolean>(() => {
      throw Error("error");
    });
    await bad.exec<boolean>(() => {
      throw Error("error");
    });
    expect(bad.state()).toBe("red");
  });

  it("should yellow light", async () => {
    const recovered = breaker("recovered", {
      failureThreshold: 3,
      successThreshold: 3,
      timeout: 0
    });
    await recovered.exec<boolean>(() => Promise.resolve({ error: "error" }));
    await recovered.exec<boolean>(() => Promise.resolve({ error: "error" }));
    await recovered.exec<boolean>(() => Promise.resolve({ error: "error" }));
    await recovered.exec<boolean>(() => Promise.resolve({ data: true }));
    await recovered.exec<boolean>(() => Promise.resolve({ data: true }));
    await recovered.exec<boolean>(() => Promise.resolve({ data: true }));
    expect(recovered.state()).toBe("yellow");
    await recovered.exec<boolean>(() => Promise.resolve({ data: true }));
    expect(recovered.state()).toBe("green");
  });

  it("should pause", async () => {
    const good = breaker("good");
    await good.exec<boolean>(() => Promise.resolve({ data: true }));
    good.pause();
    expect(good.state()).toBe("paused");
    await good.exec<boolean>(() => Promise.resolve({ data: true }));
    expect(good.state()).toBe("paused");
  });
});
