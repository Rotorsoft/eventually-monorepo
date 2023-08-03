import { CommittedEvent, store } from "@andela-technology/eventually";
import { PostgresStore } from "@andela-technology/eventually-pg";
import { PullChannel } from "../interfaces";
import { PostgresStreamListener } from "../stores";
import { TriggerCallback } from "../types";

export const PostgresPullChannel = (channel: URL): PullChannel => {
  store(PostgresStore(channel.hostname));
  const listener = PostgresStreamListener(channel.hostname);

  return {
    name: `PostgresPullChannel:${channel.href}`,
    dispose: async () => {
      await listener.close();
    },
    label: "",
    listen: (callback: TriggerCallback) => listener.listen(callback),
    pull: async ({ position, limit }) => {
      const events: CommittedEvent[] = [];
      await store().query((e) => events.push(e), {
        after: position,
        limit
      });
      return events;
    }
  };
};
