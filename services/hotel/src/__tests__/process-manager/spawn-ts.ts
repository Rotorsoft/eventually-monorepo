import { spawn } from "node:child_process";

export const spawnTs = (tsPath: string, ...args: string[]): Promise<string> =>
  new Promise((resolve) => {
    let out = "";
    const child = spawn("npx", ["ts-node", tsPath, ...args]);
    child.stdout.on("data", (data) => (out += data.toString()));
    child.once("close", () => resolve(out));
  });
