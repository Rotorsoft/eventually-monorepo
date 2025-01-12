import { store } from "@rotorsoft/eventually";

jest.spyOn(console, "log").mockImplementation();
jest.spyOn(console, "info").mockImplementation();
jest.spyOn(console, "error").mockImplementation();

describe("ports", () => {
  it("should get store stats", async () => {
    await store().commit(
      "stream",
      [
        { name: "e1", data: {} },
        { name: "e2", data: {} }
      ],
      { correlation: "", causation: {} }
    );
    const stats = await store().stats();
    expect(stats).toBeDefined();
  });
});
