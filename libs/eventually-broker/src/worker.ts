import { log } from "@rotorsoft/eventually";
import {
  ChannelResolvers,
  PullChannel,
  PushChannel,
  Subscription,
  subscriptions,
  SubscriptionStats,
  TriggerCallback,
  TriggerPayload
} from ".";

const BATCH_SIZE = 100;

const triggerLog = (trigger: TriggerPayload): string =>
  `${trigger.operation}${trigger.retries || ""}@${trigger.position}`;

const emitTrigger = (channel: string, trigger: TriggerPayload): void => {
  process.send({ channel, trigger });
};

const emitError = (error: Error): void => {
  log().error(error);
  process.send({ error: error.message });
};

const emitStats = (stats: SubscriptionStats): void => {
  log().info(
    "blue",
    `[${process.pid}] pumped ${stats.id} ${triggerLog(stats.trigger)}`,
    `at=${stats.position} total=${stats.total} batches=${stats.batches}`,
    stats.events
  );
  process.send({ stats });
};

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
    emitError(error);
    process.exit(100);
  }

  try {
    const pushUrl = new URL(sub.endpoint);
    const pushFactory = resolvers[pushUrl.protocol]?.push;
    if (!pushFactory)
      throw Error(`Cannot resolve push channel from ${sub.endpoint}`);
    pushChannel = pushFactory(sub.id, pushUrl);
  } catch (error) {
    emitError(error);
    process.exit(100);
  }

  const streams = RegExp(sub.streams);
  const names = RegExp(sub.names);

  let pumping = false;
  let retryTimeout: NodeJS.Timeout;

  const pump: TriggerCallback = async (trigger): Promise<void> => {
    if (pumping || !pushChannel) return;
    pumping = true;
    emitTrigger(sub.channel, trigger);

    const stats: SubscriptionStats = {
      id: sub.id,
      trigger,
      position: sub.position,
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
          const { status, statusText } =
            streams.test(e.stream) && names.test(e.name)
              ? await pushChannel.push(e)
              : { status: 204, statusText: "Not Matched" };

          stats.total++;
          const event = (stats.events[e.name] = stats.events[e.name] || {});
          const eventStats = (event[status] = event[status] || {
            count: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: -1
          });
          eventStats.count++;
          eventStats.min = Math.min(eventStats.min, e.id);
          eventStats.max = Math.max(eventStats.max, e.id);

          if ([200, 204].includes(status)) {
            await subscriptions().commit(sub.id, e.id);
            stats.position = sub.position = e.id;
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
            emitError(
              Error(
                `${triggerLog(trigger)} event@${
                  e.id
                } HTTP ERROR ${status} ${statusText}`
              )
            );
            return;
          }
        }
      }
    } catch (error) {
      emitError(
        Error(
          `${triggerLog(trigger)} position@${sub.position} ${error.message}`
        )
      );
      process.exit(100);
    } finally {
      emitStats(stats);
      const retries = (trigger.retries || 0) + 1;
      retry &&
        (retryTimeout = setTimeout(
          () =>
            pump({
              operation: "RETRY",
              id: trigger.id,
              retries,
              position: sub.position
            }),
          5000 * retries
        ));
      pumping = false;
    }
  };

  void pump({
    operation: "RESTART",
    id: sub.id,
    position: sub.position
  });
  void pullChannel.listen(pump);
};
