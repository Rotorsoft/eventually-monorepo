import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import {subscriptions} from "../";
import {CronJob} from 'cron';
import CronParser, { ParserOptions } from 'cron-parser';
import { PullChannel } from "../interfaces";
import { TriggerCallback } from "../types";

export const CronPullChannel = (channel: URL, id: string): PullChannel => {
  let job: CronJob;
  let position: number;

  let counter = 0;
  const decodedHref = decodeURI(channel.href);
  const decodedHostname = decodeURI(channel.hostname);

  return {
    name: `CronPullChannel:${decodedHref}`,
    // eslint-disable-next-line @typescript-eslint/require-await
    dispose: async () => {
      return job.stop();
    },
    listen: async (callback: TriggerCallback) => {
      const [service]  = await subscriptions().loadServices(id);
      const lastUpdated = service.updated;
      const options: ParserOptions = {
        currentDate: lastUpdated,
        utc: true,
      }
      const interval = CronParser.parseExpression(decodedHostname, options);
      const cronNextRun = interval.next().toDate();
      if (cronNextRun.getTime() < new Date().getTime()) {
        await callback({ id, operation: "RESTART", position: service.position + 1})
      } else {
        job = new CronJob({
          cronTime: decodedHostname,
          onTick: async () => {
            await callback({ id, operation: "RESTART", position: service.position + 1 });
          },
          start: false,
        });

        job.start()
      }      
    },
    pull: async() => {
      const [subscription] = await subscriptions().loadSubscriptionsByProducer(id);
      let eventName = subscription.names;
      eventName = eventName.substring(1, eventName.length - 1);
      position = subscription.position + 1;
      const created = new Date();
      const events: CommittedEvent<string, Payload>[] = [
        {
          id: position,
          stream: id,
          name: eventName,
          created,
          version: counter++,
        }
      ];
      return Promise.resolve(events);
    }
  };
};
