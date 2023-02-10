import { toQueryString, toAxiosRequestHeaders } from "../utils";

describe("utils", () => {
  it("should work", () => {
    const qs = toQueryString({ a: 1, b: 2 });
    expect(qs).toBe("a=1&b=2");

    const obj = { h1: true, h2: "val2", h3: 3 };
    const rh = toAxiosRequestHeaders(obj);
    expect(rh).toEqual(obj);
  });
});
