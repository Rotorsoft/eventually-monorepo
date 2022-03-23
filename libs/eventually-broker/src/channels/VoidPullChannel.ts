import { PullChannel } from "../types";

export const VoidPullChannel = (): PullChannel => ({
  pull: () => Promise.resolve([]),
  listen: () => Promise.resolve()
});
