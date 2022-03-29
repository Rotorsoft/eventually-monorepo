import { log } from "@rotorsoft/eventually";
import { ErrorMessage } from ".";
import {
  ChannelResolvers,
  Operation,
  PullChannel,
  PushChannel,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "..";
import {
  ChannelConfig,
  CommittableHttpStatus,
  RetryableHttpStatus,
  SubscriptionConfig,
  SubscriptionStats
} from "./types";

type Sub = SubscriptionConfig & {
  pushChannel: PushChannel;
  streamsRegExp: RegExp;
  namesRegExp: RegExp;
};

const triggerLog = ({ operation, retries, position }: TriggerPayload): string =>
  `[${operation}${retries || ""}${
    position ? `@${position}` : ""
  } ${new Date().toISOString()}]`;

const sendTrigger = (trigger: TriggerPayload): boolean =>
  process.send({ trigger });

const sendError = (
  message: string,
  config?: SubscriptionConfig,
  code = 500,
  color = "danger",
  stats?: SubscriptionStats
): void => {
  log().error(Error(message));
  const error: ErrorMessage = {
    message,
    config,
    code,
    color,
    stats
  };
  process.send({ error });
};

const sendStats = (
  config: SubscriptionConfig,
  stats: SubscriptionStats
): void => {
  log().info(
    "blue",
    `[${process.pid}]`,
    `📊${config.id} at=${config.position} total=${stats.total} batches=${stats.batches}`,
    stats.events
  );
  process.send({ stats: { ...stats, ...config } });
};

export const work = (resolvers: ChannelResolvers): void => {
  const config = JSON.parse(process.env.WORKER_ENV) as ChannelConfig;

  const build = (config: SubscriptionConfig): Sub => {
    const pushUrl = new URL(config.endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory)
      throw Error(`Cannot resolve push channel from ${config.endpoint}`);
    return {
      ...config,
      streamsRegExp: RegExp(config.streams),
      namesRegExp: RegExp(config.names),
      pushChannel: pushFactory(config.id, pushUrl)
    };
  };

  let pullChannel: PullChannel;
  try {
    const pullUrl = new URL(config.channel);
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory)
      throw Error(
        `Cannot resolve pull channel ${config.channel} from protocol ${pullUrl.protocol}`
      );
    pullChannel = pullFactory(config.id, pullUrl);
  } catch (error) {
    sendError(error.message);
    process.exit(1);
  }

  const _subs: Record<string, Sub> = {};
  config.subscriptions.map((config) => {
    try {
      _subs[config.id] = build(config);
    } catch (error) {
      sendError(error.message, config);
      process.exit(1);
    }
  });

  const BATCH_SIZE = 100;
  const RETRY_TIMEOUT = 10000;

  const pumpSub = async (
    sub: Sub,
    trigger: TriggerPayload
  ): Promise<Sub | undefined> => {
    const stats: SubscriptionStats = { batches: 0, total: 0, events: {} };
    let retry = false;
    try {
      let count = BATCH_SIZE;
      while (count === BATCH_SIZE) {
        stats.batches++;
        const events = await pullChannel.pull(sub.position, BATCH_SIZE);
        count = events.length;
        for (const e of events) {
          const { status, statusText } =
            sub.streamsRegExp.test(e.stream) && sub.namesRegExp.test(e.name)
              ? await sub.pushChannel.push(e)
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

          if (CommittableHttpStatus.includes(status)) {
            await subscriptions().commitPosition(sub.id, e.id);
            sub.position = e.id;
          } else {
            const retryable = RetryableHttpStatus.includes(status);
            retryable && (retry = (trigger.retries || 0) < 3);
            sendError(
              `${triggerLog(trigger)} HTTP ${status} ${statusText}`,
              sub,
              status,
              retryable ? "warning" : "danger",
              stats.total > 1 ? stats : undefined
            );
            return retry ? sub : undefined;
          }
        }
      }
      sendStats(sub, stats);
    } catch (error) {
      sendError(`${triggerLog(trigger)} ${error.message}`, sub);
      process.exit(1);
    }
  };

  let pumping = false;
  let retryTimeout: NodeJS.Timeout;
  const pumpRetry = async (
    subs: Sub[],
    trigger: TriggerPayload
  ): Promise<void> => {
    if (pumping) return;
    pumping = true;
    sendTrigger(trigger);
    clearTimeout(retryTimeout);
    const retrySubs = await Promise.all(
      subs.map((sub) => pumpSub(sub, trigger))
    );
    const retries = (trigger.retries || 0) + 1;
    retrySubs.length &&
      (retryTimeout = setTimeout(
        () =>
          pumpRetry(
            retrySubs.filter((p) => p),
            {
              operation: "RETRY",
              id: trigger.id,
              retries,
              position: trigger.position
            }
          ),
        RETRY_TIMEOUT * retries
      ));
    pumping = false;
  };

  const pumpChannel: TriggerCallback = async (trigger) => {
    await pumpRetry(Object.values(_subs), trigger);
  };

  type MasterMessage = { operation: Operation; config: SubscriptionConfig };
  process.on("message", ({ operation, config }: MasterMessage): void => {
    if (!config.active || operation === "DELETE") {
      delete _subs[config.id];
    } else {
      try {
        const sub = (_subs[config.id] = build(config));
        void pumpRetry([sub], { operation, id: config.id });
      } catch (error) {
        sendError(error.message, config);
      }
    }
    sendStats(config, { batches: 0, total: 0, events: {} });
    !Object.keys(_subs).length && process.exit(1);
  });

  void pumpChannel({
    operation: "RESTART",
    id: config.id
  });

  pullChannel.listen(pumpChannel);
};
