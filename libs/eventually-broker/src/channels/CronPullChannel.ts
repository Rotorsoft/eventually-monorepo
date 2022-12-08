import { CronJob } from "cron";
import { PullChannel } from "../interfaces";
import { TriggerCallback } from "../types";
import { camelize, CommittedEvent } from "@rotorsoft/eventually";

// trims epoch time (bigint) by a few years to make it fit in a pg bigint
const OFFSET = 1_670_000_000_000;
const trimTick = (epoch: number): number => epoch - OFFSET;

export const CronPullChannel = (channel: URL, id: string): PullChannel => {
  const eventName = camelize(id);
  const cron =
    decodeURIComponent(channel.hostname) + decodeURIComponent(channel.pathname);
  let job: CronJob | undefined;
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
          tick = trimTick(Date.now());
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
                id: trimTick(Date.now()), // set position to current time
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
