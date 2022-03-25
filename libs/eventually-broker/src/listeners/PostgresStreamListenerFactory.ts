import { log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber from "pg-listen";
import { StreamListenerFactory, subscriptions, TriggerPayload } from "..";

export const PostgresStreamListenerFactory: StreamListenerFactory = () => {
  const subscriber = createSubscriber(config.pg);

  const close = async (): Promise<void> => {
    await subscriber.close();
    await subscriptions().close();
  };

  return {
    listen: async (id, channel, callback) => {
      await subscriptions().init();

      process.on("exit", async () => {
        await close();
      });

      subscriber.events.on("error", (error) => {
        log().error(error);
        process.exit(1);
      });

      subscriber.notifications.on(
        channel.hostname,
        async (trigger: TriggerPayload): Promise<void> => {
          log().info("magenta", `[${process.pid}]`, "⚡", trigger);
          await callback(trigger);
        }
      );

      void subscriber.connect().then(async () => {
        const { href, hostname } = channel;
        await subscriber.listenTo(hostname);
        log().info("bgGreen", `[${process.pid}]`, `🏃${id} - ${href}`);
      });
    },
    close
  };
};
