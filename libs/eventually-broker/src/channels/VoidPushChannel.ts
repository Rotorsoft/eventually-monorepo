import { PushChannel } from "../interfaces";

export const VoidPushChannel = (): PushChannel => ({
  label: "",
  init: () => undefined,
  push: () => Promise.resolve({ status: 204, statusText: "VOID" })
});
