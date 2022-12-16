import { config } from "./config";
import { Color, colors, Logger } from "./interfaces";
import { LogLevels } from "./types/enums";

/** Uncolored and stringified for deployed non-dev envs */
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

export const testLogger = (): Logger => {
  const logger: Logger = {
    name: "test-logger",
    dispose: () => Promise.resolve(),
    color: () => logger,
    trace: (message: string, details?: any, ...params: any[]) => {
      config().logLevel === LogLevels.trace && plain(message, details, params);
      return logger;
    },
    info: (message: string, details?: any, ...params: any[]) => {
      config().logLevel !== LogLevels.error && plain(message, details, params);
      return logger;
    },
    error: () => logger
  };
  return logger;
};

export const devLogger = (): Logger => {
  let _colors: Color[] = ["reset"];
  const logger: Logger = {
    name: "dev-logger",
    dispose: () => Promise.resolve(),
    color: (color: Color) => {
      color === "reset" && (_colors = []);
      _colors.push(color);
      process.stdout.write(colors[color]);
      return logger;
    },
    trace: (message: string, details?: unknown, ...params: unknown[]) => {
      config().logLevel === LogLevels.trace &&
        console.log(
          message,
          colors.reset,
          colors.gray,
          JSON.stringify(details || {}),
          ...params,
          ..._colors.map((c) => colors[c])
        );
      return logger;
    },
    info: (message: string, details?: unknown, ...params: unknown[]) => {
      config().logLevel !== LogLevels.error &&
        console.info(
          message,
          colors.reset,
          colors.gray,
          details || "",
          ...params,
          ..._colors.map((c) => colors[c])
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
  const _trace = (config().logLevel === LogLevels.trace && plain) || undefined;
  const _info = (config().logLevel !== LogLevels.error && plain) || undefined;

  const logger: Logger = {
    name: "plain-logger",
    dispose: () => Promise.resolve(),
    color: () => logger,
    trace: (message: string, details?: unknown, ...params: any[]) => {
      _trace && _trace(message, details, params);
      return logger;
    },
    info: (message: string, details?: unknown, ...params: any[]) => {
      _info && _info(message, details, params);
      return logger;
    },
    error: (error: any) => {
      console.error(JSON.stringify({ severity: "ERROR", ...error }));
      return logger;
    }
  };
  return logger;
};
