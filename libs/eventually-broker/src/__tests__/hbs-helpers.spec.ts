import { hbsHelpers } from "../hbs-helpers";
import { config, Payload } from "@andela-technology/eventually";
import { formatDate, formatDateLocal, formatInt } from "../utils";

describe("hbs-helpers", () => {
  it("should work", () => {
    const obj = { a: 1, b: "2" };
    const dt = new Date();
    const h = hbsHelpers as {
      json: (obj: any) => string;
      title: () => string;
      version: () => string;
      dateFormat: (dt: Date) => string;
      toDateFormat: (dt: string) => string;
      fromISOToLocal: (dt: Date) => string;
      intFormat: (i: number) => string;
      inc: (n: number) => number;
      and: (a: boolean, b: boolean) => boolean;
      or: (a: boolean, b: boolean) => boolean;
      eq: (a: any, b: any) => boolean;
      includes: (a: string[], b: string) => boolean;
      in: (a: Payload, b: string) => boolean;
    };

    expect(h.json(obj)).toEqual(JSON.stringify(obj));
    expect(h.title()).toEqual(config().service);
    expect(h.version()).toEqual(config().version);
    expect(h.dateFormat(dt)).toEqual(formatDate(dt));
    expect(h.toDateFormat(dt.toISOString())).toEqual(formatDate(dt));
    expect(h.fromISOToLocal(dt)).toEqual(formatDateLocal(dt));
    expect(h.intFormat(1000)).toEqual(formatInt(1000));
    expect(h.inc(1)).toEqual(2);
    expect(h.and(true, true)).toBe(true);
    expect(h.or(true, false)).toBe(true);
    expect(h.or(true, true)).toBe(true);
    expect(h.or(false, false)).toBe(false);
    expect(h.eq(1, 2)).toBe(false);
    expect(h.includes(["1", "3"], "3")).toBe(true);
    expect(h.in(obj, "a")).toBe(true);
  });
});
