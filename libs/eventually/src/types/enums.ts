export enum Environments {
  development = "development",
  test = "test",
  staging = "staging",
  production = "production"
}

export enum LogLevels {
  error = "error",
  info = "info",
  trace = "trace"
}

export enum ExitCodes {
  UNIT_TEST = "UNIT_TEST",
  ERROR = "ERROR"
}

export enum Errors {
  ValidationError = "ERR_VALIDATION",
  ConcurrencyError = "ERR_CONCURRENCY",
  RegistrationError = "ERR_REGISTRATION"
}

export type ArtifactType =
  | "aggregate"
  | "system"
  | "policy"
  | "process-manager"
  | "command-adapter";
