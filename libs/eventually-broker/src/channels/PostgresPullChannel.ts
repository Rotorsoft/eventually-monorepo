import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PostgresStreamListenerFactory } from "../listeners";
import { PullChannel, TriggerCallback } from "../types";

// TODO: create pub/sub topic listener
// TODO: create salesforce stream listener

export const PostgresPullChannel = (id: string, channel: URL): PullChannel => {
  const store = PostgresStore(channel.hostname);
  const listener = PostgresStreamListenerFactory();
  return {
    pull: async (position: number, limit: number) => {
      const events: CommittedEvent<string, Payload>[] = [];
      await store.init(false);
      await store.query((e) => events.push(e), {
        after: position,
        limit
      });
      return events;
    },
    listen: async (callback: TriggerCallback): Promise<void> => {
      await store.init(false);
      await listener.listen(id, channel, callback);
    }
  };
};
