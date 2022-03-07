import {
  log,
  StreamListener,
  Subscription,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "@rotorsoft/eventually";
import createSubscriber from "pg-listen";
import { config } from "./config";

export const PostgresStreamListener: StreamListener = async (
  sub: Subscription,
  callback: TriggerCallback
): Promise<() => Promise<void>> => {
  await subscriptions().init();
  const subscriber = createSubscriber(config.pg);

  const close = async (): Promise<void> => {
    await subscriber.close();
    await subscriptions().close();
  };

  process.on("exit", async () => {
    log().info(
      "red",
      `[${process.pid}] exit ${sub.id}`,
      `${sub.channel} -> ${sub.endpoint}`
    );
    await close();
  });

  subscriber.events.on("error", (error) => {
    log().error(error);
    process.exit(1);
  });

  subscriber.notifications.on(
    sub.channel,
    async (payload: TriggerPayload): Promise<void> => {
      await callback(payload, sub);
    }
  );

  void subscriber.connect().then(async () => {
    await subscriber.listenTo(sub.channel);
    log().info(
      "green",
      `[${process.pid}] connect ${sub.id}`,
      `${sub.channel} -> ${sub.endpoint}`,
      `@ ${sub.position}`
    );
  });

  return close;
};
