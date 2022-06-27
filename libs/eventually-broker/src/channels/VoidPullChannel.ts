import { PullChannel } from "../interfaces";

export const VoidPullChannel = (): PullChannel => ({
  name: "VoidPullChannel",
  dispose: () => undefined,
  label: "",
  listen: () => undefined,
  pull: () => Promise.resolve([])
});
