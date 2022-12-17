process.env.NODE_ENV = "";
process.env.PG_HOST = "";

import { dispose, log } from "../";

jest.spyOn(console, "log").mockImplementation();
jest.spyOn(console, "info").mockImplementation();
jest.spyOn(console, "error").mockImplementation();

describe("dev logger", () => {
  afterAll(async () => {
    await dispose()();
  });

  it("should cover log", () => {
    log()
      .red()
      .green()
      .yellow()
      .blue()
      .magenta()
      .cyan()
      .silver()
      .gray()
      .white()
      .bold()
      .dimmed()
      .italic()
      .underlined();

    log().trace("message");
    log().info("message");
    log().trace("message", 1, 2, 3);
    log().info("message", 1, 2, 3);
    log().error("error");
    log().error(new Error("error"));

    expect(1).toBe(1);
  });
});
