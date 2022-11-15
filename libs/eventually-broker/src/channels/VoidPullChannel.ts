import { PullChannel } from "../interfaces";

export const VoidPullChannel = (): PullChannel => ({
  name: "VoidPullChannel",
  dispose: () => Promise.resolve(),
  label: "",
  listen: () => Promise.resolve(),
  pull: () => Promise.resolve([])
});
