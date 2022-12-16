import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber, { Subscriber } from "pg-listen";
import { TriggerPayload } from "..";
import { StreamListener } from "../interfaces";
import { TriggerCallback } from "../types";

export const PostgresStreamListener = (stream: string): StreamListener => {
  let subscriber: Subscriber | undefined;

  return {
    listen: async (callback: TriggerCallback) => {
      subscriber = createSubscriber(config.pg);
      subscriber.events.on("error", async (error) => {
        log().error(error);
        await dispose()(ExitCodes.ERROR);
      });

      subscriber.notifications.on(stream, (trigger: TriggerPayload): void => {
        callback(trigger);
      });

      await subscriber.connect();
      await subscriber.listenTo(stream);
      log()
        .color("green")
        .info(`[${process.pid}]`, "👂", stream)
        .color("reset");
    },

    close: async () => {
      subscriber && (await subscriber.close());
      subscriber = undefined;
    }
  };
};
