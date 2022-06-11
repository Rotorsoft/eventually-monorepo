import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { ErrorMessage } from ".";
import {
  ChannelResolvers,
  Operation,
  pullchannel,
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
  retries: number;
  retryTimeoutSecs: number;
  pumping: boolean;
  retryTimeout: NodeJS.Timeout;
};

const triggerLog = ({
  operation,
  retry_count,
  position
}: TriggerPayload): string =>
  `[${operation}${retry_count || ""}${
    position ? `@${position}` : ""
  } ${new Date().toISOString()}]`;

export const sendTrigger = (trigger: TriggerPayload): boolean =>
  process.send({ trigger });

export const sendError = (
  message: string,
  position: number,
  config?: SubscriptionConfig,
  code = 500,
  color = "danger",
  stats?: SubscriptionStats
): void => {
  log().error(Error(message));
  const error: ErrorMessage = {
    message,
    position,
    config,
    code,
    color,
    stats
  };
  process.send({ error });
};

export const sendStats = (
  config: SubscriptionConfig,
  stats: SubscriptionStats
): void => {
  log().info(
    "blue",
    `[${process.pid}] 📊${config.id} at=${config.position} total=${stats.total} batches=${stats.batches}`,
    JSON.stringify(stats.events)
  );
  process.send({ stats: { ...stats, ...config } });
};

export const work = async (resolvers: ChannelResolvers): Promise<void> => {
  const config = JSON.parse(process.env.WORKER_ENV) as ChannelConfig;

  const build = (config: SubscriptionConfig): Sub => {
    const pushUrl = new URL(config.endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory) throw Error(`Cannot resolve push ${config.endpoint}`);
    return {
      ...config,
      streamsRegExp: RegExp(config.streams),
      namesRegExp: RegExp(config.names),
      pushChannel: pushFactory(pushUrl, config.id),
      pumping: false,
      retryTimeout: undefined
    };
  };

  try {
    const pullUrl = new URL(config.channel);
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory) throw Error(`Cannot resolve pull ${config.channel}`);
    pullchannel(pullFactory(pullUrl, config.id));
  } catch (error) {
    error instanceof Error && sendError(error.message, -1);
    await dispose()(ExitCodes.ERROR);
  }

  const _subs: Record<string, Sub> = {};
  config.subscriptions.map(async (config) => {
    try {
      _subs[config.id] = build(config);
    } catch (error) {
      error instanceof Error && sendError(error.message, -1, config);
      await dispose()(ExitCodes.ERROR);
    }
  });

  let position = -1;
  const pumpSub = async (
    sub: Sub,
    trigger: TriggerPayload
  ): Promise<boolean> => {
    log().trace("magenta", "pumpSub", sub.id, trigger);
    const stats: SubscriptionStats = { batches: 0, total: 0, events: {} };
    try {
      if (trigger.position > position) {
        await subscriptions().commitServicePosition(
          config.id,
          trigger.position
        );
        position = trigger.position;
      }

      let count = sub.batchSize;
      while (count === sub.batchSize) {
        stats.batches++;
        const events = await pullchannel().pull(sub.position, sub.batchSize);
        count = events.length;
        for (const e of events) {
          const { status, statusText } =
            sub.streamsRegExp.test(e.stream) && sub.namesRegExp.test(e.name)
              ? await sub.pushChannel.push(e)
              : { status: 204, statusText: "Not Matched" };

          stats.lastEventName = status === 204 ? "" : e.name;
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
            await subscriptions().commitSubscriptionPosition(sub.id, e.id);
            sub.position = e.id;
          } else {
            const retryable = RetryableHttpStatus.includes(status);
            sendError(
              `${triggerLog(trigger)} HTTP ${status} ${statusText}`,
              e.id,
              sub,
              status,
              retryable ? "warning" : "danger",
              stats
            );
            return retryable && (trigger.retry_count || 0) < sub.retries;
          }
        }
        sendStats(sub, stats);
      }
    } catch (error) {
      sendError(`${triggerLog(trigger)} ${error.message}`, sub.position, sub);
      await dispose()(ExitCodes.ERROR);
    }
  };

  const pumpRetry = async (
    sub: Sub,
    trigger: TriggerPayload
  ): Promise<void> => {
    if (sub.pumping) return;
    sub.pumping = true;
    clearTimeout(sub.retryTimeout);
    const retry = await pumpSub(sub, trigger);
    const retry_count = (trigger.retry_count || 0) + 1;
    retry &&
      (sub.retryTimeout = setTimeout(async () => {
        const retry_trigger: TriggerPayload = {
          operation: "RETRY",
          id: trigger.id,
          retry_count,
          position: trigger.position
        };
        sendTrigger(retry_trigger);
        await pumpRetry(sub, retry_trigger);
      }, sub.retryTimeoutSecs * 1000 * retry_count));
    sub.pumping = false;
  };

  const pumpChannel: TriggerCallback = async (trigger) => {
    sendTrigger(trigger);
    await Promise.all(
      Object.values(_subs).map((sub) => pumpRetry(sub, trigger))
    );
  };

  type MasterMessage = { operation: Operation; config: SubscriptionConfig };
  process.on(
    "message",
    async ({ operation, config }: MasterMessage): Promise<void> => {
      if (!config.active || operation === "DELETE") {
        delete _subs[config.id];
      } else {
        try {
          const sub = (_subs[config.id] = build(config));
          const trigger: TriggerPayload = { operation, id: config.id };
          sendTrigger(trigger);
          await pumpRetry(sub, trigger);
        } catch (error) {
          error instanceof Error &&
            sendError(error.message, config.position, config);
        }
      }
      sendStats(config, { batches: 0, total: 0, events: {} });
      !Object.keys(_subs).length && (await dispose()(ExitCodes.ERROR));
    }
  );

  await pumpChannel({
    operation: "RESTART",
    id: config.id
  });

  return pullchannel().listen(pumpChannel);
};
