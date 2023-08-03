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
  RetryableError = "ERR_RETRYABLE",
  ValidationError = "ERR_VALIDATION",
  ConcurrencyError = "ERR_CONCURRENCY",
  RegistrationError = "ERR_REGISTRATION"
}
