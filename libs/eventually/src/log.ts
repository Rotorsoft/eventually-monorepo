import chalk from "chalk";
import { config } from "./config";

type Color = "red" | "green" | "magenta" | "blue" | "white" | "gray";

export interface Log {
  trace(color: Color, message: string, ...params: any[]): void;
  error(message: string, ...params: any[]): void;
  info(message: string, ...params: any[]): void;
}

const devLog: Log = {
  trace: (
    color: Color,
    message: string,
    trace?: any,
    ...params: any[]
  ): void => {
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
    console.info(message, ...params);
  }
};

const prodLog: Log = {
  trace: (): void => {
    return;
  },
  error: (message: string): void => {
    console.error(message);
  },
  info: (message: string, ...params: any[]): void => {
    console.info(message, ...params);
  }
};

let log: Log;
export const LogFactory = (): Log => {
  if (!log) log = ["development"].includes(config.env) ? devLog : prodLog;
  return log;
};
