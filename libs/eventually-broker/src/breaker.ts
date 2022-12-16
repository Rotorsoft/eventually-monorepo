import { log } from "@rotorsoft/eventually";

type Response<T> = {
  data?: T;
  error?: string;
};

export interface Breaker {
  exec: <T>(promise: () => Promise<Response<T>>) => Promise<Response<T>>;
  pause: () => void;
  state: () => States;
}

type Options = {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
};

export enum States {
  Green = "green",
  Yellow = "yellow",
  Red = "red",
  Paused = "paused"
}

export const breaker = (
  name: string,
  opts: Options = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 5000
  }
): Breaker => {
  let state: States = States.Green;
  let failureCount = 0;
  let successCount = 0;
  let nextAttempt = Date.now();

  const success = <T>(data?: T): Response<T> => {
    failureCount = 0;
    if (state === States.Yellow) {
      successCount++;
      if (successCount > opts.successThreshold) {
        successCount = 0;
        state = States.Green;
        log()
          .color("green")
          .trace(`Circuit breaker [${name}] fully restored.`)
          .color("reset");
      }
    }
    return { data };
  };

  const failure = <T>(error: string): Response<T> => {
    failureCount++;
    if (failureCount >= opts.failureThreshold) {
      state = States.Red;
      nextAttempt = Date.now() + opts.timeout;
    }
    return { error };
  };

  return {
    exec: async <T>(
      promise: () => Promise<Response<T>>
    ): Promise<Response<T>> => {
      if (state === States.Paused) return {};
      if (state === States.Red) {
        if (nextAttempt > Date.now())
          return { error: `Circuit breaker [${name}] is open!` };
        state = States.Yellow;
        log()
          .color("yellow")
          .trace(`Circuit breaker [${name}] partially restored.`)
          .color("reset");
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
      log()
        .color("red")
        .trace(`Circuit breaker [${name}] paused.`)
        .color("reset");
    },
    state: () => state
  };
};
