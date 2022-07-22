import { Disposer, Seeder } from "../types/generic";

/**
 * Disposable resources
 */
export interface Disposable {
  readonly name: string;
  dispose: Disposer;
}

/**
 * Seedable resources (i.e. to initialize or run store migrations)
 */
export interface Seedable {
  seed: Seeder;
}

/**
 * Environments
 */
export enum Environments {
  development = "development",
  test = "test",
  staging = "staging",
  production = "production"
}

/**
 * Log levels
 */
export enum LogLevels {
  error = "error",
  info = "info",
  trace = "trace"
}

export type Color =
  | "red"
  | "green"
  | "magenta"
  | "blue"
  | "white"
  | "gray"
  | "bgRed"
  | "bgGreen"
  | "bgMagenta"
  | "bgBlue"
  | "bgWhite";

/**
 * Logger
 */
export interface Log extends Disposable {
  trace(color: Color, message: string, ...params: any[]): void;
  info(color: Color, message: string, ...params: any[]): void;
  error(error: unknown): void;
}

/**
 * Base configuration
 */
export interface Config extends Disposable {
  env: Environments;
  host: string;
  port: number;
  logLevel: LogLevels;
  service: string;
  version: string;
  description: string;
  author: string;
  license: string;
  dependencies: Record<string, string>;
}
