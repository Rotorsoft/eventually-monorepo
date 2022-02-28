import {
  log,
  store,
  Subscription,
  TriggerCallback
} from "@rotorsoft/eventually";
import createSubscriber from "pg-listen";
import { config } from "./config";
import { PostgresStore } from "./PostgresStore";

export const PostgresStreamListener = async (
  sub: Subscription,
  callback: TriggerCallback
): Promise<void> => {
  let pumping = false;
  const streams = RegExp(sub.match.streams);
  const names = RegExp(sub.match.names);

  store(PostgresStore(sub.channel));
  await store().init();
  const subscriber = createSubscriber(config.pg);

  process.on("exit", () => {
    log().info(
      "red",
      `exit ${process.pid}`,
      `${sub.channel} -> ${sub.endpoint}`
    );
    void subscriber.close();
    void store().close();
  });

  subscriber.events.on("error", (error) => {
    log().error(error);
    process.exit(1);
  });

  subscriber.notifications.on(sub.channel, async (event): Promise<void> => {
    if (!pumping) {
      pumping = true;
      await callback(event, sub.channel, sub.endpoint, streams, names);
      pumping = false;
    }
  });

  void subscriber.connect().then(async () => {
    await subscriber.listenTo(sub.channel);
    log().info(
      "green",
      `connect ${process.pid}`,
      `${sub.channel} -> ${sub.endpoint}`
    );
  });
};
