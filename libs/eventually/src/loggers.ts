import { config } from "./config";
import { Logger } from "./interfaces";
import { CommittedEvent } from "./types";

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

const plain = (
  message: string,
  details?: unknown,
  ...params: unknown[]
): void => {
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: `${message} ${details}`,
      params
    })
  );
};

const error = (error: any): void => {
  console.error(JSON.stringify({ severity: "ERROR", ...error }));
};

const events = (events: CommittedEvent[]): void => {
  console.table(
    events.map(({ id, stream, name, version, created, data, metadata }) => ({
      id,
      stream,
      name,
      version,
      created,
      actor: `${metadata.causation.command?.actor?.name}:${metadata.causation.command?.actor?.id}`,
      data: JSON.stringify(data).substring(0, 20)
    })),
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
    trace: (message: string, details?: unknown, ...params: unknown[]) =>
      config().logLevel === "trace" &&
      console.log(
        message,
        code(Effect.reset, Color.gray),
        JSON.stringify(details || {}),
        ...params,
        code(Effect.reset)
      ),
    info: (message: string, details?: unknown, ...params: unknown[]) =>
      config().logLevel !== "error" &&
      console.info(
        message,
        code(Effect.reset, Color.gray),
        details || "",
        ...params,
        code(Effect.reset)
      ),
    error: (error: unknown) => {
      console.error(error);
    },
    events
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
    trace:
      (config().env !== "test" && config().logLevel === "trace" && plain) ||
      nop,
    info:
      (config().env !== "test" && config().logLevel !== "error" && plain) ||
      nop,
    error: (config().env !== "test" && error) || nop,
    events
  };
  return logger;
};
