const instances: { [name: string]: unknown } = {};
/**
 * Wraps creation of singletons around factory functions
 * @param target the factory function
 * @returns the singleton function
 */
export const singleton =
  <T>(target: (arg?: T) => T) =>
  (arg?: T): T => {
    !instances[target.name] && (instances[target.name] = target(arg));
    return instances[target.name] as T;
  };

export enum ExitCodes {
  UNIT_TEST = "UNIT_TEST",
  OK = "OK",
  ERROR = "ERROR"
}
type Disposer = () => Promise<void>;
const disposers: Disposer[] = [];
const disposeAll = async (
  code: ExitCodes = ExitCodes.UNIT_TEST
): Promise<void> => {
  while (disposers.length) {
    const disposer = disposers.pop();
    await disposer();
  }
  code !== ExitCodes.UNIT_TEST && process.exit(code === ExitCodes.OK ? 0 : 1);
};
/**
 * Registers resource disposers that are triggered on process exit
 * @param disposer the disposer function
 * @returns a fuction that triggers all registered disposers - useful for unit testing teardown
 */
export const dispose = (
  disposer?: Disposer
): ((code?: ExitCodes) => Promise<void>) => {
  disposer && disposers.push(disposer);
  return disposeAll;
};

["SIGINT", "SIGTERM", "uncaughtException"].map((e) => {
  process.once(e, async () => {
    console.log(`[${process.pid}] ${e}`);
    await disposeAll(e === "SIGINT" ? ExitCodes.OK : ExitCodes.ERROR);
  });
});
