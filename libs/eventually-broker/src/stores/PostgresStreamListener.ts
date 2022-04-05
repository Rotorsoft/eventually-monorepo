import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber from "pg-listen";
import { TriggerPayload } from "..";
import { StreamListener } from "../interfaces";
import { TriggerCallback } from "../types";

export const PostgresStreamListener = (stream: string): StreamListener => {
  const subscriber = createSubscriber(config.pg);

  return {
    listen: async (callback: TriggerCallback) => {
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
      await subscriber.close();
    }
  };
};
