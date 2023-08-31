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
  prev: Readonly<S | Patch<S>>,
  curr: Readonly<Patch<S>>
): Readonly<S | Patch<S>> => {
  const copy: State = {};
  Object.keys({ ...prev, ...curr }).forEach((key) => {
    const patched = !!curr && key in curr;
    const deleted =
      patched && (typeof curr[key] === "undefined" || curr[key] === null);
    const value = patched && !deleted ? curr[key] : prev[key];
    if (!deleted) {
      if (mergeable(value))
        copy[key] = patch(prev[key] || {}, curr && curr[key]);
      else copy[key] = value;
    }
  });
  return copy as S;
};
