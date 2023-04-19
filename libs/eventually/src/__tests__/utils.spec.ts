import { camelize, dateReviver, decamelize, formatTime } from "../utils";

describe("utils", () => {
  it("should camelize", () => {
    expect(camelize("a-b-c")).toBe("ABC");
    expect(camelize("aaa-bbb-ccc")).toBe("AaaBbbCcc");
    expect(camelize("aa---bb--cc")).toBe("AaBbCc");
  });

  it("should decamelize", () => {
    expect(decamelize("ABC")).toBe("abc");
    expect(decamelize("AaaBbbCcc")).toBe("aaa-bbb-ccc");
    expect(decamelize("AaBbCc")).toBe("aa-bb-cc");
  });

  it("should format time", () => {
    const et1 = formatTime(process.uptime());
    expect(et1.length).toBe(5);
    const et2 = formatTime(process.uptime() + 2 * 60 * 60);
    expect(et2.length).toBe(8);
    const et3 = formatTime(process.uptime() + 25 * 60 * 60);
    expect(et3.length).toBeGreaterThan(8);
  });

  it.each([
    "2020-03-01T00:00:00.000Z",
    "2020-03-01T12:00:00.000Z",
    "2020-03-23T23:59:59.000Z",
    "2020-03-01T12:00:00.00Z",
    "2020-03-01T00:00:00.000",
    "2020-03-23T23:59:59.000+00:00",
    "2020-03-23T23:59:59.000-05:00"
  ])("should revive %s", (value: string) => {
    const result = dateReviver("", value);
    expect(result instanceof Date).toBeTruthy();
  });

  it.each([
    "1234",
    "abcd",
    "2020-03-23T23:59:60.000Z",
    "2020-03-23T23:59:59.000+",
    "2020-03-23T23:59:59.000-"
  ])("should not revive %s", (value: string) => {
    const result = dateReviver("", value);
    expect(result instanceof Date).toBeFalsy();
  });
});
