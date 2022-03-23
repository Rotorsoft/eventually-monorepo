import { log } from "@rotorsoft/eventually";
import {
  ChannelResolvers,
  PullChannel,
  PushChannel,
  subscriptions,
  WorkerStats,
  TriggerCallback,
  TriggerPayload,
  WorkerConfig
} from ".";

const BATCH_SIZE = 100;

const triggerLog = (trigger: TriggerPayload): string =>
  `${trigger.operation}${trigger.retries || ""}@${trigger.position}`;

const emitChannel = (channel: string, position: number): void => {
  process.send({ channel, position });
};

const emitError = (error: string, position: number): void => {
  log().error(Error(error));
  process.send({ error, position });
};

const emitStats = (stats: WorkerStats, position: number): void => {
  log().info(
    "blue",
    `[${process.pid}] ⚡${stats.id} ${triggerLog(stats.trigger)}`,
    `at=${position} total=${stats.total} batches=${stats.batches}`,
    stats.events
  );
  process.send({ stats, position });
};

export const work = (resolvers: ChannelResolvers): void => {
  const { id, channel, endpoint, streams, names, position } = JSON.parse(
    process.env.WORKER_ENV
  ) as WorkerConfig;
  let pullChannel: PullChannel;
  let pushChannel: PushChannel;
  log().info("bgGreen", `[${process.pid}]`, `🏃${id} ...`);

  try {
    const pullUrl = new URL(channel);
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory)
      throw Error(
        `Cannot resolve pull channel ${channel} from protocol ${pullUrl.protocol}`
      );
    pullChannel = pullFactory(id, pullUrl);
  } catch (error) {
    emitError(error.message, position);
    process.exit(100);
  }

  try {
    const pushUrl = new URL(endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory)
      throw Error(`Cannot resolve push channel from ${endpoint}`);
    pushChannel = pushFactory(id, pushUrl);
  } catch (error) {
    emitError(error.message, position);
    process.exit(100);
  }

  const streamsRegEx = RegExp(streams);
  const namesRegEx = RegExp(names);

  let current = position;
  let pumping = false;
  let retryTimeout: NodeJS.Timeout;

  const pump: TriggerCallback = async (trigger): Promise<void> => {
    if (pumping || !pushChannel) return;
    pumping = true;
    emitChannel(channel, trigger.position);

    const stats: WorkerStats = {
      id,
      trigger,
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
        const events = await pullChannel.pull(current, BATCH_SIZE);
        count = events.length;
        for (const e of events) {
          const { status, statusText } =
            streamsRegEx.test(e.stream) && namesRegEx.test(e.name)
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
            await subscriptions().commitPosition(id, e.id);
            current = e.id;
          } else {
            if ([429, 503, 504].includes(status)) {
              // 429 - Too Many Requests
              // 503 - Service Unavailable
              // 504 - Gateway Timeout
              retry = (trigger.retries || 0) < 3;
            }
            emitError(
              `${triggerLog(trigger)} event@${
                e.id
              } HTTP ERROR ${status} ${statusText}`,
              current
            );
            return;
          }
        }
      }
    } catch (error) {
      emitError(
        `${triggerLog(trigger)} position@${current} ${error.message}`,
        current
      );
      process.exit(100);
    } finally {
      emitStats(stats, current);
      const retries = (trigger.retries || 0) + 1;
      retry &&
        (retryTimeout = setTimeout(
          () =>
            pump({
              operation: "RETRY",
              id: trigger.id,
              retries,
              position: current
            }),
          5000 * retries
        ));
      pumping = false;
    }
  };

  void pump({ operation: "RESTART", id, position });
  void pullChannel.listen(pump);
};
