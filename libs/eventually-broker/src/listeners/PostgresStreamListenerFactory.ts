import { dispose, log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber from "pg-listen";
import { TriggerPayload } from "..";
import { StreamListenerFactory } from "../types";

export const PostgresStreamListenerFactory: StreamListenerFactory = (
  id,
  channel,
  callback
) => {
  log().info(
    "bgGreen",
    `[${process.pid}]`,
    `✨PostgresStreamListener ${id} ${channel.href}...`
  );
  const subscriber = createSubscriber(config.pg);

  dispose(() => {
    log().info(
      "bgRed",
      `[${process.pid}]`,
      `💣PostgresStreamListener ${id} ${channel.href}...`
    );
    void subscriber.close();
  });

  subscriber.events.on("error", (error) => {
    log().error(error);
    process.exit();
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
};
