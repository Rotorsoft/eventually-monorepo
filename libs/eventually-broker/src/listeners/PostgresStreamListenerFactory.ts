import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import createSubscriber from "pg-listen";
import { TriggerPayload } from "..";
import { StreamListenerFactory } from "../types";

export const PostgresStreamListenerFactory: StreamListenerFactory = (
  stream,
  callback
) => {
  log().info(
    "bgGreen",
    `[${process.pid}]`,
    `✨PostgresStreamListener ${stream}...`
  );
  const subscriber = createSubscriber(config.pg);

  dispose(() => {
    log().info(
      "bgRed",
      `[${process.pid}]`,
      `💣PostgresStreamListener ${stream}...`
    );
    return subscriber.close();
  });

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

  void subscriber.connect().then(async () => {
    await subscriber.listenTo(stream);
    log().info("bgGreen", `[${process.pid}]`, `👂${stream}`);
  });
};
