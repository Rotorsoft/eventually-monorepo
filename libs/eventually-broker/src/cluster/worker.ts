import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { ErrorMessage } from ".";
import {
  ChannelResolvers,
  pullchannel,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "..";
import {
  ChannelConfig,
  CommittableHttpStatus,
  MasterMessage,
  RetryableHttpStatus,
  SubscriptionState,
  SubscriptionWithEndpoint
} from "./types";

let channel_position = -1;
const triggerLog = (
  { operation, retry_count }: TriggerPayload,
  sub_position: number
): string =>
  `[${operation}${
    retry_count || ""
  } @${sub_position}/${channel_position} ${new Date().toISOString()}]`;

const sendTrigger = (trigger: TriggerPayload): void => {
  try {
    process.send({ trigger });
  } catch (error) {
    log().error(error);
  }
};

const sendError = (message: string, state?: SubscriptionState): void => {
  const error: ErrorMessage = {
    message,
    state
  };
  try {
    process.send({ error });
  } catch (error) {
    log().error(error);
  }
};

const sendState = (state: SubscriptionState): void => {
  log().info(
    "blue",
    `[${process.pid}] 📊${state.id} at=${state.position} total=${state.stats.total} batches=${state.stats.batches}`,
    JSON.stringify(state.stats.events)
  );
  try {
    process.send({ state });
  } catch (error) {
    log().error(error);
  }
};

export const work = async (
  resolvers: ChannelResolvers
): Promise<Record<string, SubscriptionState>> => {
  const config = JSON.parse(process.env.WORKER_ENV) as ChannelConfig;

  const toState = ({
    id,
    active,
    endpoint,
    streams,
    names,
    position,
    batch_size,
    retries,
    retry_timeout_secs
  }: SubscriptionWithEndpoint): SubscriptionState => {
    const pushUrl = new URL(endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory) throw Error(`Cannot resolve push ${endpoint}`);
    // TODO: discover consumer /_endpoints to match path to events
    return {
      id,
      active,
      endpoint,
      position,
      streamsRegExp: RegExp(streams),
      namesRegExp: RegExp(names),
      pushChannel: pushFactory(pushUrl, id),
      batchSize: batch_size,
      retries,
      retryTimeoutSecs: retry_timeout_secs,
      pumping: false,
      retryTimeout: undefined,
      endpointStatus: {
        name: "",
        code: 200,
        color: "success",
        icon: active ? "bi-activity" : ""
      },
      stats: { batches: 0, total: 0, events: {} },
      errorMessage: "",
      errorPosition: -1
    };
  };

  const subStates: Record<string, SubscriptionState> = {};
  try {
    const pullUrl = new URL(config.channel);
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory) throw Error(`Cannot resolve pull ${config.channel}`);
    pullchannel(pullFactory(pullUrl, config.id));
    Object.values(config.subscriptions).forEach(
      (sub) => (subStates[sub.id] = toState(sub))
    );
  } catch (error) {
    log().error(error);
    error instanceof Error && sendError(error.message);
    await dispose()(ExitCodes.ERROR);
  }

  const pumpSub = async (
    subState: SubscriptionState,
    trigger: TriggerPayload
  ): Promise<boolean> => {
    log().trace("magenta", "pumpSub", subState.id, trigger);
    try {
      channel_position = Math.max(channel_position, subState.position);
      if (trigger.position > channel_position) {
        await subscriptions().commitServicePosition(
          config.id,
          trigger.position
        );
        channel_position = trigger.position;
      }

      let count = subState.batchSize;
      while (count === subState.batchSize) {
        subState.stats.batches++;
        const events = await pullchannel().pull(
          subState.position,
          subState.batchSize
        );
        count = events.length;
        for (const e of events) {
          const { status, statusText } =
            subState.streamsRegExp.test(e.stream) &&
            subState.namesRegExp.test(e.name)
              ? await subState.pushChannel.push(e)
              : { status: 204, statusText: "Not Matched" };

          subState.stats.total++;
          const event = (subState.stats.events[e.name] =
            subState.stats.events[e.name] || {});
          const eventStats = (event[status] = event[status] || {
            count: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: -1
          });
          eventStats.count++;
          eventStats.min = Math.min(eventStats.min, e.id);
          eventStats.max = Math.max(eventStats.max, e.id);

          if (CommittableHttpStatus.includes(status)) {
            await subscriptions().commitSubscriptionPosition(subState.id, e.id);
            subState.position = e.id;
            subState.endpointStatus = {
              name: e.name,
              code: status,
              color: "success",
              icon: "bi-activity"
            };
            subState.errorMessage = "";
          } else {
            const retryable = RetryableHttpStatus.includes(status);
            subState.endpointStatus = {
              name: e.name,
              code: status,
              color: retryable ? "warning" : "danger",
              icon: "bi-cone-striped"
            };
            subState.errorMessage = `${triggerLog(
              trigger,
              e.id
            )} HTTP ${status} ${statusText}`;
            subState.errorPosition = e.id;
            sendError(subState.errorMessage, subState);
            return retryable && (trigger.retry_count || 0) < subState.retries;
          }
        }
        sendState(subState);
      }
    } catch (error) {
      log().error(error);
      subState.errorMessage = `${triggerLog(trigger, subState.position)} ${
        error.message
      }`;
      subState.errorPosition = subState.position;
      subState.endpointStatus = {
        name: undefined,
        code: 500,
        color: "danger",
        icon: "bi-cone-striped"
      };
      sendError(subState.errorMessage, subState);
      await dispose()(ExitCodes.ERROR);
    }
  };

  const pumpRetry = async (
    subState: SubscriptionState,
    trigger: TriggerPayload
  ): Promise<void> => {
    if (subState.pumping) return;
    subState.pumping = true;
    clearTimeout(subState.retryTimeout);
    const retry = await pumpSub(subState, trigger);
    const retry_count = (trigger.retry_count || 0) + 1;
    retry &&
      (subState.retryTimeout = setTimeout(async () => {
        const retry_trigger: TriggerPayload = {
          operation: "RETRY",
          id: trigger.id,
          retry_count,
          position: trigger.position
        };
        sendTrigger(retry_trigger);
        await pumpRetry(subState, retry_trigger);
      }, subState.retryTimeoutSecs * 1000 * retry_count));
    subState.pumping = false;
  };

  const pumpChannel: TriggerCallback = async (trigger) => {
    sendTrigger(trigger);
    await Promise.all(
      Object.values(subStates).map((sub) => pumpRetry(sub, trigger))
    );
  };

  process.on(
    "message",
    async ({ operation, sub }: MasterMessage): Promise<void> => {
      if (!sub.active || operation === "DELETE") {
        delete subStates[sub.id];
      } else {
        const currentState = subStates[sub.id];
        const subState = (subStates[sub.id] = toState(sub));
        currentState && Object.assign(subState.stats, currentState.stats);
        try {
          const trigger: TriggerPayload = { operation, id: sub.id };
          sendTrigger(trigger);
          await pumpRetry(subState, trigger);
        } catch (error) {
          log().error(error);
          if (error instanceof Error) {
            subState.errorMessage = error.message;
            subState.errorPosition = subState.position;
            subState.endpointStatus = {
              name: undefined,
              code: 500,
              color: "danger",
              icon: "bi-cone-striped"
            };
            sendError(error.message, subState);
          }
        }
      }
      !Object.keys(subStates).length && (await dispose()(ExitCodes.ERROR));
    }
  );

  await pumpChannel({
    operation: "RESTART",
    id: config.id
  });

  await pullchannel().listen(pumpChannel);

  return subStates;
};
