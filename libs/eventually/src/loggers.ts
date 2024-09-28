import { Logger } from "./interfaces";
import { CommittedEvent, LogLevel } from "./types";

const { LOG_LEVEL } = process.env;

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
    write: (message: string) => {
      process.stdout.write(message);
      return logger;
    },
    events,
    trace: (message: string, details?: unknown, ...params: unknown[]) => {
      active("trace") &&
        console.log(
          message,
          code(Effect.reset, Color.gray),
          details ? JSON.stringify(details) : "",
          ...params,
          code(Effect.reset)
        );
      return logger;
    },
    data: (message: string, details?: unknown, ...params: unknown[]) => {
      active("data") &&
        console.log(
          message,
          code(Effect.reset, Color.gray),
          JSON.stringify(details || {}),
          ...params,
          code(Effect.reset)
        );
      return logger;
    },
    info: (message: string, details?: unknown, ...params: unknown[]) => {
      active("info") &&
        console.info(
          message,
          code(Effect.reset, Color.gray),
          details || "",
          ...params,
          code(Effect.reset)
        );
      return logger;
    },
    error: (error: unknown) => {
      console.error(error);
      return logger;
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
    write: (message: string) => {
      process.stdout.write(message);
      return logger;
    },
    events,
    trace: (message: string, details?: unknown, ...params: unknown[]) => {
      active("trace") && json("trace", message, details, params);
      return logger;
    },
    data: (message: string, details?: unknown, ...params: unknown[]) => {
      active("data") && json("data", message, details, params);
      return logger;
    },
    info: (message: string, details?: unknown, ...params: unknown[]) => {
      active("info") && json("info", message, details, params);
      return logger;
    },
    error: (error: any) => {
      console.error(
        JSON.stringify({ level: "error", severity: "ERROR", ...error })
      );
      return logger;
    }
  };
  return logger;
};

export const testLogger = (): Logger => {
  const logger: Logger = {
    name: "test-logger",
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
    write: () => logger,
    events: () => {},
    trace: () => logger,
    data: () => logger,
    info: () => logger,
    error: () => logger
  };
  return logger;
};
