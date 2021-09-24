import chalk from "chalk";
import { config, LogLevels } from "./config";

type Color = "red" | "green" | "magenta" | "blue" | "white" | "gray";

export interface Log {
  trace(color: Color, message: string, ...params: any[]): void;
  error(message: string, ...params: any[]): void;
  info(message: string, ...params: any[]): void;
}

let log: Log;
export const LogFactory = (): Log => {
  if (!log)
    log = {
      trace: (
        color: Color,
        message: string,
        trace?: any,
        ...params: any[]
      ): void => {
        if (config.logLevel === LogLevels.trace)
          console.log(
            chalk[color](message),
            chalk.gray(JSON.stringify(trace || {})),
            ...params
          );
      },
      error: (message: string, ...params: any[]): void => {
        console.error(message, ...params);
      },
      info: (message: string, ...params: any[]): void => {
        if (config.logLevel !== LogLevels.error)
          console.info(message, ...params);
      }
    };
  return log;
};
