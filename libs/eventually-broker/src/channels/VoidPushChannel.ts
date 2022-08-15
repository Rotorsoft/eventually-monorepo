import { PushChannel } from "../interfaces";

export const VoidPushChannel = (): PushChannel => ({
  label: "",
  init: () => undefined,
  push: (events) => {
    events.forEach((event) => (event.response = { statusCode: 204 }));
    return Promise.resolve(204);
  }
});
