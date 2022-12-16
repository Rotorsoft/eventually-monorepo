import { Disposable } from "./generic";

export type Color =
  | "reset"
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "hidden"
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray";

export const colors: Record<Color, string> = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  hidden: "\x1b[8m",
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m"
};

export interface Logger extends Disposable {
  color(color: Color): Logger;
  trace(message: string, ...params: any[]): Logger;
  info(message: string, ...params: any[]): Logger;
  error(error: unknown): Logger;
}
