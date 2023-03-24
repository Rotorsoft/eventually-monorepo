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
  InvariantError = "ERR_INVARIANT",
  ConcurrencyError = "ERR_CONCURRENCY",
  RegistrationError = "ERR_REGISTRATION"
}
