import chalk from "chalk";
import { config, LogLevels } from "./config";
import { Singleton } from "./utils";

type Color = "red" | "green" | "magenta" | "blue" | "white" | "gray";

export interface Log {
  trace(color: Color, message: string, ...params: any[]): void;
  error(error: Error): void;
  info(color: Color, message: string, ...params: any[]): void;
}

export const log = Singleton(function log() {
  return {
    trace: (
      color: Color,
      message: string,
      trace?: any,
      ...params: any[]
    ): void => {
      if (config().logLevel === LogLevels.trace)
        console.log(
          chalk[color](message),
          chalk.gray(JSON.stringify(trace || {})),
          ...params
        );
    },
    error: (error: Error): void => {
      console.error(error);
    },
    info: (color: Color, message: string, ...params: any[]): void => {
      if (config().logLevel !== LogLevels.error)
        console.info(chalk[color](message), ...params);
    }
  };
});
