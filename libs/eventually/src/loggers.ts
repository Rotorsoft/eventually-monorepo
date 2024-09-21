import { Logger } from "./interfaces";
import { CommittedEvent, LogLevel } from "./types";

const { NODE_ENV, LOG_LEVEL } = process.env;

const Color = {
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  silver: 37,
  gray: 90,
  white: 97
};

const Effect = {
  reset: 0,
  bold: 1,
  dimmed: 2,
  italic: 3,
  underlined: 4
};

const Levels: Record<LogLevel, number> = {
  error: 0,
  info: 1,
  data: 2,
  trace: 3
};

const active = (level: LogLevel): boolean =>
  Levels[level] <= Levels[LOG_LEVEL as LogLevel];

const code = (...code: Array<number>): string =>
  code.map((c) => `\x1b[${c}m`).join("");

const color = (logger: Logger, color: keyof typeof Color): Logger => {
  process.stdout.write(code(Color[color]));
  return logger;
};

const effect = (logger: Logger, effect: keyof typeof Effect): Logger => {
  process.stdout.write(code(Effect[effect]));
  return logger;
};

const nop = (): void => {
  return;
};

const json = (
  level: LogLevel,
  message: string,
  details?: unknown,
  ...params: unknown[]
): void => {
  console.log(
    JSON.stringify({
      level,
      severity: "INFO",
      message: `${message} ${details}`,
      params
    })
  );
};

const trace = (
  message: string,
  details?: unknown,
  ...params: unknown[]
): void => json("trace", message, details, params);

const data = (message: string, details?: unknown, ...params: unknown[]): void =>
  json("data", message, details, params);

const info = (message: string, details?: unknown, ...params: unknown[]): void =>
  json("info", message, details, params);

const error = (error: any): void => {
  console.error(
    JSON.stringify({ level: "error", severity: "ERROR", ...error })
  );
};

const events = (events: CommittedEvent[]): void => {
  console.table(
    events.map(({ id, stream, name, version, created, data, metadata }) => {
      const { actor } = metadata.causation.command || {};
      return {
        id,
        stream,
        name,
        version,
        created,
        actor: actor ? `${actor.id}:${actor.name}` : "",
        data: JSON.stringify(data).substring(0, 50)
      };
    }),
    ["id", "stream", "name", "version", "created", "actor", "data"]
  );
};

export const devLogger = (): Logger => {
  const logger: Logger = {
    name: "dev-logger",
    dispose: () => Promise.resolve(),
    red: () => color(logger, "red"),
    green: () => color(logger, "green"),
    yellow: () => color(logger, "yellow"),
    blue: () => color(logger, "blue"),
    magenta: () => color(logger, "magenta"),
    cyan: () => color(logger, "cyan"),
    silver: () => color(logger, "silver"),
    gray: () => color(logger, "gray"),
    white: () => color(logger, "white"),
    bold: () => effect(logger, "bold"),
    dimmed: () => effect(logger, "dimmed"),
    italic: () => effect(logger, "italic"),
    underlined: () => effect(logger, "underlined"),
    events,
    trace: (message: string, details?: unknown, ...params: unknown[]) =>
      active("trace") &&
      console.log(
        message,
        code(Effect.reset, Color.gray),
        JSON.stringify(details || {}),
        ...params,
        code(Effect.reset)
      ),
    data: (message: string, details?: unknown, ...params: unknown[]) =>
      active("data") &&
      console.log(
        message,
        code(Effect.reset, Color.gray),
        JSON.stringify(details || {}),
        ...params,
        code(Effect.reset)
      ),
    info: (message: string, details?: unknown, ...params: unknown[]) =>
      active("info") &&
      console.info(
        message,
        code(Effect.reset, Color.gray),
        details || "",
        ...params,
        code(Effect.reset)
      ),
    error: (error: unknown) => {
      console.error(error);
    }
  };
  return logger;
};

export const plainLogger = (): Logger => {
  const logger: Logger = {
    name: "plain-logger",
    dispose: () => Promise.resolve(),
    red: () => logger,
    green: () => logger,
    yellow: () => logger,
    blue: () => logger,
    magenta: () => logger,
    cyan: () => logger,
    silver: () => logger,
    gray: () => logger,
    white: () => logger,
    bold: () => logger,
    dimmed: () => logger,
    italic: () => logger,
    underlined: () => logger,
    events,
    trace: (NODE_ENV !== "test" && active("trace") && trace) || nop,
    data: (NODE_ENV !== "test" && active("data") && data) || nop,
    info: (NODE_ENV !== "test" && active("info") && info) || nop,
    error: (NODE_ENV !== "test" && error) || nop
  };
  return logger;
};
