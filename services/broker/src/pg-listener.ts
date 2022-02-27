import createSubscriber from "pg-listen";
import { log, store, Subscription } from "@rotorsoft/eventually";
import { PostgresStore, config } from "@rotorsoft/eventually-pg";
import { pump } from "./pump";

export const work = async (): Promise<void> => {
  // TODO store subscription lease in db (redis?)
  let pumping = false;

  const sub: Subscription = JSON.parse(
    process.env.SUBSCRIPTION
  ) as Subscription;
  if (sub) {
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
        await pump(event, sub.channel, sub.endpoint, streams, names);
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
  }
};
