import chalk from "chalk";
import { config } from "./config";
import { Color, Environments, Log, LogLevels } from "./interfaces";
import { singleton } from "./singleton";

/** Uncolored and stringified for deployed non-dev envs */
const plain = (
  _: Color,
  message: string,
  details?: any,
  ...params: any[]
): void => {
  console.log(JSON.stringify({ severity: "INFO", message, details, params }));
};

const trace = (
  color: Color,
  message: string,
  details?: any,
  ...params: any[]
): void => {
  console.log(
    chalk[color](message),
    chalk.gray(JSON.stringify(details || {})),
    ...params
  );
};

const info = (
  color: Color,
  message: string,
  details?: string,
  ...params: any[]
): void => {
  console.info(chalk[color](message), chalk.gray(details || ""), ...params);
};

const error = ({ message, details }: Error & { details?: any }): void => {
  console.error(JSON.stringify({ severity: "ERROR", message, details }));
};

const nolog = (): void => {
  return;
};

const testLog = (): Log => ({
  name: "testLog",
  dispose: () => undefined,
  trace: config().logLevel === LogLevels.trace ? trace : nolog,
  info: config().logLevel !== LogLevels.error ? info : nolog,
  error: nolog
});

const devLog = (): Log => ({
  name: "devLog",
  dispose: () => undefined,
  trace: config().logLevel === LogLevels.trace ? trace : nolog,
  info: config().logLevel !== LogLevels.error ? info : nolog,
  error
});

const plainLog = (): Log => ({
  name: "plainLog",
  dispose: () => undefined,
  trace: config().logLevel === LogLevels.trace ? plain : nolog,
  info: config().logLevel !== LogLevels.error ? plain : nolog,
  error
});

export const log = singleton(function log() {
  switch (config().env) {
    case Environments.test:
      return testLog();
    case Environments.development:
      return devLog();
    default:
      return plainLog();
  }
});
