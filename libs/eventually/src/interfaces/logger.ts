import { CommittedEvent } from "../types";
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
  write(message: string): Logger;
  events(events: CommittedEvent[]): void;
  trace(message: string, ...params: any[]): Logger;
  data(message: string, ...params: any[]): Logger;
  info(message: string, ...params: any[]): Logger;
  error(error: unknown): Logger;
}
