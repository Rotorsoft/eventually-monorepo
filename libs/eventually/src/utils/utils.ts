/**
 * Promisify setTimeout
 * @param millis the millis to sleep
 */
export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));

/**
 * Function debouncer
 */
type DF = (this: ThisParameterType<void>, ...args: any[]) => void;
export const debounce = (func: DF, delay: number): DF => {
  let timeout: NodeJS.Timeout;
  return function (this: ThisParameterType<void>, ...args: any[]): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

/**
 * Function throttler
 */
export const throttle = <T extends (...args: unknown[]) => ReturnType<T>>(
  func: T,
  delay: number
): ((this: ThisParameterType<T>, ...args: Parameters<T>) => void) => {
  let last = 0;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= delay) {
      func.apply(this, args);
      last = now;
    }
  };
};
