import { camelize, decamelize } from "../utils";

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
});
