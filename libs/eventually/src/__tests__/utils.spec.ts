import { camelize, decamelize, formatTime } from "../utils";

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
});
