process.env.NODE_ENV = "";
process.env.PG_HOST = "";
process.env.PG_SNAPSHOTS_TABLE = "";

describe("config", () => {
  it("should initialize in dev mode and fail validation", async () => {
    const { config, Environments } = await import("@rotorsoft/eventually");
    expect(config().env).toEqual(Environments.development);

    await expect(import("@rotorsoft/eventually-pg")).rejects.toThrowError(
      '"pg.host" is not allowed to be empty'
    );
  });

  it("should cover log error", async () => {
    const { log } = await import("@rotorsoft/eventually");
    log().error(Error("error"));
    expect(true).toEqual(true);
  });
});
