process.env.NODE_ENV = "";
process.env.PG_HOST = "";

describe("config", () => {
  it("should initialize in dev mode and fail validation", async () => {
    const { config, Environments } = await import("@rotorsoft/eventually");
    expect(config().env).toEqual(Environments.development);

    await expect(import("@rotorsoft/eventually-pg")).rejects.toThrow();
  });

  it("should cover log error", async () => {
    const { log } = await import("@rotorsoft/eventually");
    log().error(Error("error"));
    expect(true).toEqual(true);
  });
});
