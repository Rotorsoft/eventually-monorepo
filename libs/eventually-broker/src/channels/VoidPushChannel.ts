import { PushChannel } from "../interfaces";

export const VoidPushChannel = (): PushChannel => ({
  label: "",
  init: () => Promise.resolve(),
  push: (events) => {
    events.forEach((event) => (event.response = { statusCode: 204 }));
    return Promise.resolve(204);
  }
});
