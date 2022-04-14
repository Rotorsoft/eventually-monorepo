import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import { PullChannel } from "../interfaces";
import { TriggerCallback } from "../types";

export const CronPullChannel = (channel: URL): PullChannel => {
  // TODO: initialize your cron engine from channel.hostname making sure cron regex is valid
  let counter = 0;

  return {
    name: `CronPullChannel:${channel.hostname}`,
    dispose: async () => {
      // TODO: dispose cron
      return Promise.resolve();
    },
    listen: (callback: TriggerCallback) => {
      // TODO: callback when cron engine triggers next tick
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
          stream: channel.hostname,
          name: "CronTriggered",
          created,
          version: counter++
        }
      ];
      return Promise.resolve(events);
    }
  };
};
