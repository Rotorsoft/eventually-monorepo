import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import { PullChannel } from "../interfaces";
import { TriggerCallback } from "../types";

export const CronPullChannel = (channel: URL, id: string): PullChannel => {
  // TODO: initialize your cron engine from channel.hostname making sure cron regex is valid
  // TODO: load last trigger from storage - pg table? will need seed but we can add this to the subscriptions store
  let counter = 0;

  return {
    name: `CronPullChannel:${channel.hostname}`,
    dispose: async () => {
      // TODO: dispose cron
      return Promise.resolve();
    },
    listen: (callback: TriggerCallback) => {
      // TODO: callback when cron engine triggers next tick and persist last cron trigger by id
      setTimeout(
        () => callback({ id: channel.hostname, operation: "RESTART" }),
        10000
      );
      return Promise.resolve();
    },
    pull: () => {
      // TODO: prepare a cron event
      const created = new Date();
      const events: CommittedEvent<string, Payload>[] = [
        {
          id: created.getTime(),
          stream: id,
          name: "CronTriggered",
          created,
          version: counter++
        }
      ];
      return Promise.resolve(events);
    }
  };
};
