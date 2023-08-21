export const Environments = [
  "development",
  "test",
  "staging",
  "production"
] as const;
export type Environment = (typeof Environments)[number];

export const LogLevels = ["error", "info", "data", "trace"] as const;
export type LogLevel = (typeof LogLevels)[number];

export const Scopes = ["public", "private", "default"] as const;
/**
 * Artifact registration scopes
 * - `public` input handlers are public (as HTTP endpoints)
 * - `private` input handlers are only avilable within the service via client() ports
 * - `default` command handlers are public, event handlers are private when event producers are found within the service, otherwise public
 */
export type Scope = (typeof Scopes)[number];

export const ExitCodes = ["UNIT_TEST", "ERROR"] as const;
/**
 * Application exit codes
 * - `UNIT_TEST` to flag unit tests, avoiding process exits on errors
 * - `ERROR` exit on errors
 */
export type ExitCode = (typeof ExitCodes)[number];

export const Operators = [
  "eq",
  "neq",
  "lt",
  "gt",
  "lte",
  "gte",
  "in",
  "nin"
] as const;
/**
 * Filter operators
 * - `eq` equal
 * - `neq` not equal
 * - `lt` less than
 * - `gt` greater than
 * - `lte` less than or equal
 * - `gte` greater than or equal
 * - `in` includes
 * - `nin` not includes
 */
export type Operator = (typeof Operators)[number];
