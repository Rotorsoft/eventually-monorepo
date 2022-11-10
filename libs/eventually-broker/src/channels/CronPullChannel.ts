import { CronJob } from "cron";
import { PullChannel } from "../interfaces";
import { TriggerCallback } from "../types";
import { camelize, CommittedEvent } from "@rotorsoft/eventually";

export const CronPullChannel = (channel: URL, id: string): PullChannel => {
  const eventName = camelize(id);
  const cron =
    decodeURIComponent(channel.hostname) + decodeURIComponent(channel.pathname);
  let job: CronJob;
  let tick: number, version: number;

  return {
    name: `CronPullChannel:${id}`,
    dispose: () => {
      if (job) {
        job.stop();
        job = undefined;
      }
      return Promise.resolve();
    },
    label: "⏰",

    listen: (callback: TriggerCallback) => {
      job = new CronJob({
        cronTime: cron,
        onTick: () => {
          tick = Date.now();
          callback({ id, operation: "RESTART", position: tick - 1 }); // tick-1 to ensure pull
        },
        start: false
      });
      tick = -1;
      version = 0;
      job.start();
      return Promise.resolve();
    },

    pull: ({ operation, position }) =>
      Promise.resolve(
        position < tick || operation === "MANUAL"
          ? [
              {
                id: Date.now(), // set position to current time
                stream: id,
                name: eventName,
                created: new Date(),
                version: ++version
              } as CommittedEvent
            ]
          : []
      )
  };
};
