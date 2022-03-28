import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PostgresStreamListenerFactory } from "../listeners";
import { PullChannel, TriggerCallback } from "../types";

export const PostgresPullChannel = (id: string, channel: URL): PullChannel => {
  const store = PostgresStore(channel.hostname);
  return {
    pull: async (position: number, limit: number) => {
      const events: CommittedEvent<string, Payload>[] = [];
      await store.query((e) => events.push(e), {
        after: position,
        limit
      });
      return events;
    },
    listen: (callback: TriggerCallback) =>
      PostgresStreamListenerFactory(id, channel, callback)
  };
};
