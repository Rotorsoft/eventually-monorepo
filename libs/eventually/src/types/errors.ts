import { Errors } from "../types/enums";
import { Message } from "../types/messages";

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

export class InvariantError extends Error {
  public readonly details;
  constructor(command: Message, description: string) {
    super(`${command.name || ""} failed invariant: ${description}`);
    this.name = Errors.InvariantError;
    this.details = { command, description };
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

export class RegistrationError extends Error {
  constructor(message: Message) {
    super(`Message "${message.name}" not registered with app builder!`);
    this.name = Errors.RegistrationError;
  }
}
