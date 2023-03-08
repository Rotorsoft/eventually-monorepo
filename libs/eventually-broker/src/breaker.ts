import { log } from "@rotorsoft/eventually";

/**
 * Circuit breaker response
 */
export type BreakerResponse<T> = {
  data?: T;
  error?: string;
};

/**
 * Circuit breaker interface
 */
export interface Breaker {
  exec: <T>(
    promise: () => Promise<BreakerResponse<T>>
  ) => Promise<BreakerResponse<T>>;
  pause: () => void;
  state: () => States;
}

/**
 * Circuit breaker options
 */
export type BreakerOptions = {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
};

/**
 * Circuit breaker states
 */
export enum States {
  Green = "green",
  Yellow = "yellow",
  Red = "red",
  Paused = "paused"
}

/**
 * Circuit breaker utility
 *
 * @param name - circuit name
 * @param opts - options
 * @returns a new circuit breaker
 */
export const breaker = (
  name: string,
  opts: BreakerOptions = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5000
  }
): Breaker => {
  let state: States = States.Green;
  let failureCount = 0;
  let successCount = 0;
  let nextAttempt = Date.now();

  const success = <T>(data?: T): BreakerResponse<T> => {
    failureCount = 0;
    if (state === States.Yellow) {
      successCount++;
      if (successCount > opts.successThreshold) {
        successCount = 0;
        state = States.Green;
        log().green().trace(`Circuit breaker [${name}] fully restored.`);
      }
    }
    return { data };
  };

  const failure = <T>(error: string): BreakerResponse<T> => {
    failureCount++;
    if (failureCount >= opts.failureThreshold) {
      state = States.Red;
      nextAttempt = Date.now() + opts.timeout;
    }
    return { error };
  };

  return {
    exec: async <T>(
      promise: () => Promise<BreakerResponse<T>>
    ): Promise<BreakerResponse<T>> => {
      if (state === States.Paused) return {};
      if (state === States.Red) {
        if (nextAttempt > Date.now())
          return { error: `Circuit breaker [${name}] is open!` };
        state = States.Yellow;
        log().yellow().trace(`Circuit breaker [${name}] partially restored.`);
      }
      try {
        const { error, data } = await promise();
        return error ? failure(error) : success(data);
      } catch (err: any) {
        return failure(err.message as string);
      }
    },
    pause: () => {
      state = States.Paused;
      log().red().trace(`Circuit breaker [${name}] paused.`);
    },
    state: () => state
  };
};
