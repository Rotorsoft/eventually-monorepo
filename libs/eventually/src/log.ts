import chalk from "chalk";
import { Environments } from ".";
import { config, LogLevels } from "./config";
import { singleton } from "./singleton";

type Color = "red" | "green" | "magenta" | "blue" | "white" | "gray";

export interface Log {
  trace(color: Color, message: string, ...params: any[]): void;
  error(error: Error): void;
  info(color: Color, message: string, ...params: any[]): void;
}

export const log = singleton(function log() {
  return {
    trace: (
      color: Color,
      message: string,
      details?: any,
      ...params: any[]
    ): void => {
      if (config().logLevel === LogLevels.trace)
        console.log(
          chalk[color](message),
          chalk.gray(JSON.stringify(details || {})),
          ...params
        );
    },
    error: (error: Error): void => {
      if (config().env !== Environments.test) console.error(error);
    },
    info: (
      color: Color,
      message: string,
      details?: string,
      ...params: any[]
    ): void => {
      if (config().logLevel !== LogLevels.error)
        console.info(
          chalk[color](message),
          chalk.gray(details || ""),
          ...params
        );
    }
  };
});
