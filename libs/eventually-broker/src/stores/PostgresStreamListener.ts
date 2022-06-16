import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber, { Subscriber } from "pg-listen";
import { TriggerPayload } from "..";
import { StreamListener } from "../interfaces";
import { TriggerCallback } from "../types";

export const PostgresStreamListener = (stream: string): StreamListener => {
  let subscriber: Subscriber;

  return {
    listen: async (callback: TriggerCallback) => {
      subscriber = createSubscriber(config.pg);
      subscriber.events.on("error", async (error) => {
        log().error(error);
        await dispose()(ExitCodes.ERROR);
      });

      subscriber.notifications.on(
        stream,
        async (trigger: TriggerPayload): Promise<void> => {
          log().info("magenta", `[${process.pid}]`, "⚡", trigger);
          await callback(trigger);
        }
      );

      await subscriber.connect();
      await subscriber.listenTo(stream);
      log().info("bgGreen", `[${process.pid}]`, "👂", stream);
    },

    close: async () => {
      subscriber && (await subscriber.close());
      subscriber = undefined;
    }
  };
};
