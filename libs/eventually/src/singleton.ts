import { Disposable } from "./interfaces";
import { Disposer } from "./types";

const instances: Record<string, Disposable> = {};
/**
 * Wraps creation of singletons around factory functions
 * @param target the factory function
 * @returns the singleton function
 */
export const singleton =
  <T extends Disposable>(target: (arg?: T) => T) =>
  (arg?: T): T => {
    if (!instances[target.name]) {
      instances[target.name] = target(arg);
      console.log(
        `[${process.pid}]`,
        `✨ ${instances[target.name].name || target.name}`
      );
    }
    return instances[target.name] as T;
  };

export enum ExitCodes {
  UNIT_TEST = "UNIT_TEST",
  OK = "OK",
  ERROR = "ERROR"
}
const disposers: Disposer[] = [];
const disposeAndExit = async (
  code: ExitCodes = ExitCodes.UNIT_TEST
): Promise<void> => {
  await Promise.all(disposers.map((disposer) => disposer()));
  await Promise.all(
    Object.entries(instances).map(async ([key, instance]) => {
      console.log(`[${process.pid}]`, `♻️ ${instance.name || key}`);
      await instance.dispose();
      delete instances[key];
    })
  );
  code !== ExitCodes.UNIT_TEST && process.exit(code === ExitCodes.OK ? 0 : 1);
};
/**
 * Registers resource disposers that are triggered on process exit
 * @param disposer the disposer function
 * @returns a function that triggers all registered disposers and terminates the process
 */
export const dispose = (
  disposer?: Disposer
): ((code?: ExitCodes) => Promise<void>) => {
  disposer && disposers.push(disposer);
  return disposeAndExit;
};

["SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"].map((e) => {
  process.once(e, async (arg?: any) => {
    console.error(`[${process.pid}]`, arg || e);
    await disposeAndExit(e === "SIGINT" ? ExitCodes.OK : ExitCodes.ERROR);
  });
});

/**
 * Bootstrap wrapper with above process error handlers in scope
 * @param boot async function to boot app
 */
export const bootstrap = async (boot: () => Promise<void>): Promise<void> => {
  await boot();
};
