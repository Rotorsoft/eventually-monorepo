import {
  CommittedEvent,
  log,
  Payload,
  PullChannel,
  TriggerCallback
} from "@rotorsoft/eventually";
import { PostgresStore } from ".";
import { PostgresStreamListenerFactory } from "./PostgresStreamListenerFactory";

// TODO: create pub/sub topic listener
// TODO: create salesforce stream listener

export const PostgresPullChannel = (id: string, channel: URL): PullChannel => {
  const store = PostgresStore(channel.hostname);
  const listener = PostgresStreamListenerFactory();
  return {
    pull: async (position: number, limit: number) => {
      const events: CommittedEvent<string, Payload>[] = [];
      try {
        await store.init(false);
        await store.query((e) => events.push(e), {
          after: position,
          limit
        });
        return events;
      } catch (error) {
        log().error(error);
        process.exit(100);
      }
    },
    listen: async (callback: TriggerCallback): Promise<void> => {
      try {
        await store.init(false);
        await listener.listen(id, channel, callback);
      } catch (error) {
        log().error(error);
        process.exit(100);
      }
    }
  };
};
