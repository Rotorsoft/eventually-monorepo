import { log } from "@rotorsoft/eventually";
import {
  ChannelResolvers,
  PullChannel,
  PushChannel,
  Subscription,
  subscriptions,
  SubscriptionStats,
  TriggerCallback
} from ".";

const BATCH_SIZE = 100;

export const work = (resolvers: ChannelResolvers): void => {
  const sub: Subscription = JSON.parse(process.env.WORKER_ENV) as Subscription;
  let pullChannel: PullChannel;
  let pushChannel: PushChannel;

  try {
    const pullUrl = new URL(sub.channel);
    const pullFactory = resolvers[pullUrl.protocol]?.pull;
    if (!pullFactory)
      throw Error(
        `Cannot resolve pull channel ${sub.channel} from protocol ${pullUrl.protocol}`
      );
    pullChannel = pullFactory(sub.id, pullUrl);
  } catch (error) {
    log().error(error);
    process.exit(100);
  }

  try {
    const pushUrl = new URL(sub.endpoint);
    const pushFactory = resolvers[pushUrl.protocol]?.push;
    if (!pushFactory)
      throw Error(`Cannot resolve push channel from ${sub.endpoint}`);
    pushChannel = pushFactory(sub.id, pushUrl);
  } catch (error) {
    log().error(error);
    process.exit(100);
  }

  const streams = RegExp(sub.streams);
  const names = RegExp(sub.names);

  let pumping = false;
  let retryTimeout: NodeJS.Timeout;

  const pump: TriggerCallback = async (trigger): Promise<void> => {
    if (pumping || !pushChannel) return;
    pumping = true;

    const stats: SubscriptionStats = {
      after: sub.position,
      batches: 0,
      total: 0,
      events: {}
    };

    let retry = false;
    clearTimeout(retryTimeout);
    try {
      let count = BATCH_SIZE;
      while (count === BATCH_SIZE) {
        stats.batches++;
        const events = await pullChannel.pull(sub.position, BATCH_SIZE);
        count = events.length;
        for (const e of events) {
          const { status } =
            streams.test(e.stream) && names.test(e.name)
              ? await pushChannel.push(e)
              : { status: 204 };

          stats.total++;
          const event = (stats.events[e.name] = stats.events[e.name] || {});
          event[status] = (event[status] || 0) + 1;

          if ([200, 204].includes(status)) {
            await subscriptions().commit(sub.id, e.id);
            sub.position = e.id;
          } else {
            if ([429, 503, 504].includes(status)) {
              // 429 - Too Many Requests
              // 503 - Service Unavailable
              // 504 - Gateway Timeout
              retry = (trigger.retries || 0) < 3;
            } else if (status === 409) {
              // consumers (event handlers) should not return concurrency errors
              // is the reponsibility of the policy to deal with concurrent issues from internal aggregates
              log().error(
                Error(
                  `Consumer endpoint ${sub.endpoint} returned 409 when processing event ${e.id}-${e.name}`
                )
              );
            }
            return;
          }
        }
      }
    } finally {
      log().info(
        "blue",
        `[${process.pid}] pumped ${sub.id} ${trigger.operation}${
          trigger.retries || ""
        }@${trigger.id}`,
        `after=${stats.after} total=${stats.total} batches=${stats.batches}`,
        stats.events
      );
      const retries = (trigger.retries || 0) + 1;
      retry &&
        (retryTimeout = setTimeout(
          () =>
            pump({
              operation: "RETRY",
              id: sub.position.toString(),
              retries
            }),
          5000 * retries
        ));
      pumping = false;
    }
  };

  void pump({ operation: "RESTART", id: sub.position.toString() });
  void pullChannel.listen(pump);
};
