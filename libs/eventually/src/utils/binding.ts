import type { Message, Messages, ProjectionPatch, State } from "../types";

/**
 * Binds message names and data
 * @param name the message name
 * @param data the message payload
 * @returns The bound message
 */
export const bind = <M extends Messages, N extends keyof M & string>(
  name: N,
  data: Readonly<M[N]>
): Message<M, N> => ({ name, data });

/**
 * Shortcut to return promise of [bind]
 */
export const emit = <M extends Messages, N extends keyof M & string>(
  name: N,
  data: Readonly<M[N]>
): Promise<Message<M, N>[]> => Promise.resolve([bind(name, data)]);

/**
 * Shortcut to return promise of command message
 */
export const cmd = <C extends Messages, N extends keyof C & string>(
  name: N,
  data: Readonly<C[N]>,
  stream: string,
  expectedVersion?: number
): Promise<Message<C, N>> =>
  Promise.resolve({ name, data, stream, expectedVersion });

/**
 * Shortcut to return promise of projection patches
 */
export const prj = <S extends State>(
  ...patches: ProjectionPatch<S>[]
): Promise<ProjectionPatch<S>[]> => Promise.resolve(patches);
