import { CommandTarget, Message, Messages } from "../types/messages";

/**
 * Application error types
 * - `ERR_VALIDATION` schema validation error
 * - `ERR_INVARIANT` invariant validation error
 * - `ERR_CONCURRENCY` optimistic concurrency validation error on aggregate commits
 * - `ERR_ACTOR_CONCURRENCY` optimistic concurrency validation error on actor (process manager) commits
 * - `ERR_REGISTRATION` schema registration error
 */
export const Errors = {
  ValidationError: "ERR_VALIDATION",
  InvariantError: "ERR_INVARIANT",
  ConcurrencyError: "ERR_CONCURRENCY",
  ActorConcurrencyError: "ERR_ACTOR_CONCURRENCY",
  RegistrationError: "ERR_REGISTRATION"
} as const;

export class ValidationError extends Error {
  public readonly details;
  constructor(errors: string[], message?: Message) {
    super(
      `${message?.name || ""} failed validation ${errors
        .map((e) => `[${e}]`)
        .join(" ")}`
    );
    this.name = Errors.ValidationError;
    this.details = { errors, message };
  }
}

export class InvariantError<M extends Messages> extends Error {
  public readonly details;
  constructor(
    name: keyof M & string,
    data: Readonly<M[keyof M & string]>,
    target: CommandTarget,
    description: string
  ) {
    super(`${name} failed invariant: ${description}`);
    this.name = Errors.InvariantError;
    this.details = { name, data, target, description };
  }
}

export class ConcurrencyError extends Error {
  constructor(
    public readonly lastVersion: number,
    public readonly events: Message[],
    public readonly expectedVersion: number
  ) {
    super(
      `Concurrency error committing event "${
        events.at(0)?.name
      }". Expected version ${expectedVersion} but found version ${lastVersion}.`
    );
    this.name = Errors.ConcurrencyError;
  }
}

export class ActorConcurrencyError extends Error {
  constructor(
    public readonly actor: string,
    public readonly event: Message,
    public readonly count: number,
    public readonly expectedCount: number
  ) {
    super(
      `Actor ${actor} concurrency error committing event "${event.name}". Expected event count ${expectedCount} did not match ${count}.`
    );
    this.name = Errors.ActorConcurrencyError;
  }
}

export class RegistrationError extends Error {
  constructor(message: Message) {
    super(`Message "${message.name}" not registered with app builder!`);
    this.name = Errors.RegistrationError;
  }
}
