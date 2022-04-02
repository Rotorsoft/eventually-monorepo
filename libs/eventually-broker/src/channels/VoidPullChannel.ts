import { PullChannel } from "../interfaces";

export const VoidPullChannel = (): PullChannel => ({
  name: "VoidPullChannel",
  dispose: () => undefined,
  listen: () => undefined,
  pull: () => Promise.resolve([])
});
