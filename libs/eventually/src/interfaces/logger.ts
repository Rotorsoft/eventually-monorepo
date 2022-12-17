import { Disposable } from "./generic";

export interface Logger extends Disposable {
  red(): Logger;
  green(): Logger;
  yellow(): Logger;
  blue(): Logger;
  magenta(): Logger;
  cyan(): Logger;
  silver(): Logger;
  gray(): Logger;
  white(): Logger;
  bold(): Logger;
  dimmed(): Logger;
  italic(): Logger;
  underlined(): Logger;
  trace(message: string, ...params: any[]): void;
  info(message: string, ...params: any[]): void;
  error(error: unknown): void;
}
