import chalk from "chalk";
import { Environments } from ".";
import { config, LogLevels } from "./config";
import { singleton } from "./singleton";

type Color =
  | "red"
  | "green"
  | "magenta"
  | "blue"
  | "white"
  | "gray"
  | "bgRed"
  | "bgGreen"
  | "bgMagenta"
  | "bgBlue"
  | "bgWhite";

export interface Log {
  trace(color: Color, message: string, ...params: any[]): void;
  info(color: Color, message: string, ...params: any[]): void;
  error(error: Error): void;
}

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

const error = (error: Error): void => {
  console.error(JSON.stringify({ severity: "ERROR", message: error.message }));
};

const nolog = (): void => {
  return;
};

const testLog = (): Log => ({
  trace: config().logLevel === LogLevels.trace ? trace : nolog,
  info: config().logLevel !== LogLevels.error ? info : nolog,
  error: nolog
});

const devLog = (): Log => ({
  trace: config().logLevel === LogLevels.trace ? trace : nolog,
  info: config().logLevel !== LogLevels.error ? info : nolog,
  error
});

const plainLog = (): Log => ({
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
