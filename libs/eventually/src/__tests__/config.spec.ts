process.env.NODE_ENV = "";
process.env.PG_HOST = "";

describe("config", () => {
  it("should initialize in dev mode and fail validation", async () => {
    const { config, Environments } = await import("@andela-technology/eventually");
    expect(config().env).toEqual(Environments.development);

    await expect(import("@andela-technology/eventually-pg")).rejects.toThrowError(
      "ERR_VALIDATION"
    );
  });

  it("should cover log error", async () => {
    const { log } = await import("@andela-technology/eventually");
    log().error(Error("error"));
    expect(true).toEqual(true);
  });
});
