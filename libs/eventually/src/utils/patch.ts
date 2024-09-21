import type { Patch, State } from "../types";

/** These objects are copied instead of deep merged */
const UNMERGEABLES = [
  RegExp,
  Date,
  Array,
  Map,
  Set,
  WeakMap,
  WeakSet,
  ArrayBuffer,
  SharedArrayBuffer,
  DataView,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array
];

const mergeable = (value: any): boolean =>
  !!value &&
  typeof value === "object" &&
  !UNMERGEABLES.some((t) => value instanceof t);

/**
 * Copies state with patches recursively. Keys with `undefined` or `null` values in patch are deleted.
 * @param prev original state
 * @param curr patches to merge
 * @returns a new patched state
 */
export const patch = <S extends State>(
  prev: Readonly<Patch<S>>,
  curr: Readonly<Patch<S>>
): Readonly<Patch<S>> => {
  const copy = {} as Record<string, any>;
  Object.keys({ ...prev, ...curr }).forEach((key) => {
    const curr_value = curr[key as keyof typeof curr];
    const prev_value = prev[key as keyof typeof prev];
    const patched = curr && key in curr;
    const deleted =
      patched && (typeof curr_value === "undefined" || curr_value === null);
    const value = patched && !deleted ? curr_value : prev_value;

    if (!deleted) {
      if (mergeable(value)) {
        copy[key] = patch(prev_value || {}, curr_value || {});
      } else {
        copy[key] = value;
      }
    }
  });
  return copy as Patch<S>;
};
