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

type Disposer = () => void;
const disposers: Disposer[] = [];
const disposeAll = (): void => {
  while (disposers.length) {
    const disposer = disposers.pop();
    disposer();
  }
};
/**
 * Registers resource disposers that are triggered on process exit
 * @param disposer the disposer function
 * @returns a fuction that triggers all registered disposers - useful for unit testing teardown
 */
export const dispose = (disposer?: Disposer): Disposer => {
  disposer && disposers.push(disposer);
  return disposeAll;
};

process.once("exit", disposeAll);

process.once("SIGINT", () => {
  console.log(`[${process.pid}] SIGINT - ctrl+c`);
  process.exit();
});

process.once("SIGTERM", () => {
  console.log(`[${process.pid}] SIGTERM - kill`);
  process.exit(1);
});

process.once("uncaughtException", (error) => {
  console.error(error.name, error.message);
  process.exit(1);
});
