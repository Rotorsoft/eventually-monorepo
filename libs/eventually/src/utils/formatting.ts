/**
 * Camelizes string
 * @param value decamelized string
 * @returns camelized string
 */
export const camelize = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/**
 * Decamelizes string
 * @param value camelized string
 * @returns decamelized string
 */
export const decamelize = (value: string): string =>
  value
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, "$1-$2")
    .replace(
      /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      "$1-$2"
    )
    .toLowerCase();

const HOUR_SECS = 60 * 60;
const DAY_SECS = 24 * HOUR_SECS;
/** Formats seconds into elapsed time string */
export const formatTime = (seconds: number): string => {
  const iso = new Date(seconds * 1000).toISOString();
  if (seconds < HOUR_SECS) return iso.substring(14, 19);
  if (seconds < DAY_SECS) return iso.substring(11, 19);
  return `${Math.round(seconds / DAY_SECS)} days ${iso.substring(11, 19)}`;
};

/**
 * Date reviver when parsing JSON strings with the following formats:
 * - YYYY-MM-DDTHH:MM:SS.sssZ
 * - YYYY-MM-DDTHH:MM:SS.sss+HH:MM
 * - YYYY-MM-DDTHH:MM:SS.sss-HH:MM
 */
const ISO_8601 =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d+)?(Z|[+-][0-2][0-9]:[0-5][0-9])?$/;
export const dateReviver = (key: string, value: string): string | Date => {
  if (typeof value === "string" && ISO_8601.test(value)) {
    try {
      return new Date(value);
    } catch {
      return value;
    }
  }
  return value;
};
