import { log } from "../ports";

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
export type States = "green" | "yellow" | "red" | "paused";

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
  let state: States = "green";
  let failureCount = 0;
  let successCount = 0;
  let nextAttempt = Date.now();

  const success = <T>(data?: T): BreakerResponse<T> => {
    failureCount = 0;
    if (state === "yellow") {
      successCount++;
      if (successCount > opts.successThreshold) {
        successCount = 0;
        state = "green";
        log().green().trace(`Circuit breaker [${name}] fully restored.`);
      }
    }
    return { data };
  };

  const failure = <T>(error: string): BreakerResponse<T> => {
    failureCount++;
    if (failureCount >= opts.failureThreshold) {
      state = "red";
      nextAttempt = Date.now() + opts.timeout;
    }
    return { error };
  };

  return {
    exec: async <T>(
      promise: () => Promise<BreakerResponse<T>>
    ): Promise<BreakerResponse<T>> => {
      if (state === "paused") return {};
      if (state === "red") {
        if (nextAttempt > Date.now())
          return { error: `Circuit breaker [${name}] is open!` };
        state = "yellow";
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
      state = "paused";
      log().red().trace(`Circuit breaker [${name}] paused.`);
    },
    state: () => state
  };
};
