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
        async (payload: TriggerPayload): Promise<void> => {
          await callback(payload);
        }
      );

      void subscriber.connect().then(async () => {
        const { href, hostname } = channel;
        await subscriber.listenTo(hostname);
        log().info("green", `[${process.pid}] pulling ${id}`, href);
      });
    },
    close
  };
};
