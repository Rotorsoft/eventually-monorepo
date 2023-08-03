import { Payload } from "@andela-technology/eventually";
import { AxiosRequestHeaders } from "axios";

const usnf = new Intl.NumberFormat("en-US");
const usdf = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short"
});

export const formatInt = (int: number): string => {
  try {
    return usnf.format(int);
  } catch {
    return "-";
  }
};

export const formatDate = (date: Date): string => {
  try {
    return usdf.format(date);
  } catch {
    return "-";
  }
};

export const formatDateLocal = (date: Date): string => {
  try {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
      .toISOString()
      .substring(0, 16);
  } catch {
    return "";
  }
};

/**
 * Ensures argument is returned as an array
 * @param anyOrArray The argument
 * @returns The ensured array
 */
export const ensureArray = (anyOrArray: any | any[]): any[] =>
  Array.isArray(anyOrArray) ? anyOrArray : [anyOrArray];

/**
 * Builds query string from payload
 */
const toQS = (key: string, val: any): string => `&${key}=${val.toString()}`;
export const toQueryString = (payload: Payload): string =>
  Object.entries(payload)
    .filter(([, val]) => val)
    .reduce(
      (q, [key, val]) =>
        Array.isArray(val)
          ? val.map((v) => q.concat(toQS(key, v))).join("")
          : q.concat(toQS(key, val)),
      ""
    );

/**
 * Builds headers from payload
 */
export const toAxiosRequestHeaders = (payload: Payload): AxiosRequestHeaders =>
  Object.entries(payload).reduce((h, [key, val]) => {
    h[key] =
      typeof val === "boolean" || typeof val === "number"
        ? val
        : (val as any).toString();
    return h;
  }, {} as AxiosRequestHeaders);

// export const safeStringify = (val: any): string => {
//   let cache: Array<any> = [];
//   const result = JSON.stringify(
//     val,
//     (key, value) =>
//       typeof value === "object" && value !== null
//         ? cache.includes(value)
//           ? `circular:${key}`
//           : cache.push(value) && value
//         : value,
//     2
//   );
//   cache = null;
//   return result;
// };
