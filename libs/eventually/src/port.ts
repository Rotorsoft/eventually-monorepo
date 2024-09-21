import { Disposable, Disposer } from "./interfaces";
import { ExitCode } from "./types/enums";

const log = (message: string): void => {
  (process.env.NODE_ENV || "development") === "development" &&
    console.log(`[${process.pid}]`, message);
};

const adapters = new Map<string, Disposable>();
/**
 * Wraps creation of adapters around factory functions
 * @param target the factory function
 * @returns the adapter function
 */
export const port =
  <T extends Disposable>(target: (arg?: T) => T) =>
  (arg?: T): T => {
    if (!adapters.has(target.name)) {
      const adapter = target(arg);
      adapters.set(target.name, adapter);
      log(`created adapter: ${adapter.name || target.name}`);
    }
    return adapters.get(target.name) as T;
  };

const disposers: Disposer[] = [];
const disposeAndExit = async (code: ExitCode = "UNIT_TEST"): Promise<void> => {
  await Promise.all(disposers.map((disposer) => disposer()));
  await Promise.all(
    [...adapters].reverse().map(async ([key, adapter]) => {
      log(`disposed adapter: ${adapter.name || key}`);
      await adapter.dispose();
    })
  );
  adapters.clear();
  code !== "UNIT_TEST" && process.exit(1);
};
/**
 * Registers resource disposers that are triggered on process exit
 * @param disposer the disposer function
 * @returns a function that triggers all registered disposers and terminates the process
 */
export const dispose = (
  disposer?: Disposer
): ((code?: ExitCode) => Promise<void>) => {
  disposer && disposers.push(disposer);
  return disposeAndExit;
};

["SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"].map((e) => {
  process.once(e, async (arg?: any) => {
    log(`${e} ${arg !== e ? arg : ""}`);
    await disposeAndExit("ERROR");
  });
});

/**
 * Bootstrap wrapper with above process error handlers in scope
 * @param boot async function to boot app
 */
export const bootstrap = async (boot: () => Promise<void>): Promise<void> => {
  await boot();
};
