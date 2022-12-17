import { config } from "./config";
import { Logger } from "./interfaces";
import { Environments, LogLevels } from "./types/enums";

enum Color {
  red = 31,
  green = 32,
  yellow = 33,
  blue = 34,
  magenta = 35,
  cyan = 36,
  silver = 37,
  gray = 90,
  white = 97
}

enum Effect {
  reset = 0,
  bold = 1,
  dimmed = 2,
  italic = 3,
  underlined = 4
}

const code = (...code: Array<Color | Effect>): string =>
  code.map((c) => `\x1b[${c}m`).join("");

const color = (logger: Logger, color: Color): Logger => {
  process.stdout.write(code(color));
  return logger;
};

const effect = (logger: Logger, effect: Effect): Logger => {
  process.stdout.write(code(effect));
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

export const devLogger = (): Logger => {
  const logger: Logger = {
    name: "dev-logger",
    dispose: () => Promise.resolve(),
    red: () => color(logger, Color.red),
    green: () => color(logger, Color.green),
    yellow: () => color(logger, Color.yellow),
    blue: () => color(logger, Color.blue),
    magenta: () => color(logger, Color.magenta),
    cyan: () => color(logger, Color.cyan),
    silver: () => color(logger, Color.silver),
    gray: () => color(logger, Color.gray),
    white: () => color(logger, Color.white),
    bold: () => effect(logger, Effect.bold),
    dimmed: () => effect(logger, Effect.dimmed),
    italic: () => effect(logger, Effect.italic),
    underlined: () => effect(logger, Effect.underlined),
    trace: (message: string, details?: unknown, ...params: unknown[]) =>
      config().logLevel === LogLevels.trace &&
      console.log(
        message,
        code(Effect.reset, Color.gray),
        JSON.stringify(details || {}),
        ...params,
        code(Effect.reset)
      ),
    info: (message: string, details?: unknown, ...params: unknown[]) =>
      config().logLevel !== LogLevels.error &&
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
    trace: (config().logLevel === LogLevels.trace && plain) || nop,
    info: (config().logLevel !== LogLevels.error && plain) || nop,
    error: (config().env !== Environments.test && error) || nop
  };
  return logger;
};
