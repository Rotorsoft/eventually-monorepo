import { PushChannel } from "../types";

export const VoidPushChannel = (): PushChannel => ({
  init: () => undefined,
  push: () => Promise.resolve({ status: 204, statusText: "VOID" })
});
