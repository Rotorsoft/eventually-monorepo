import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import { ErrorMessage } from ".";
import {
  ChannelResolvers,
  pullchannel,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "..";
import { formatDate, getServiceEndpoints } from "../utils";
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
  `${operation}${
    retry_count || ""
  } [${sub_position}/${channel_position}] ${formatDate(new Date())}`;

const sendTrigger = (trigger: TriggerPayload): void => {
  try {
    process.send({ trigger });
  } catch (error) {
    log().error(error);
  }
};

const sendError = (message: string): void => {
  const error: ErrorMessage = { message };
  process.send({ error });
};

const sendState = (state: SubscriptionState): void => {
  log().info(
    "blue",
    `[${process.pid}] 📊${state.id} at=${state.position} total=${state.stats.total} batches=${state.stats.batches}`,
    JSON.stringify(state.stats.events)
  );
  process.send({ state });
};

export const work = async (
  resolvers: ChannelResolvers
): Promise<Record<string, SubscriptionState>> => {
  const config = JSON.parse(process.env.WORKER_ENV) as ChannelConfig;
  const subStates: Record<string, SubscriptionState> = {};

  const toState = async ({
    id,
    active,
    path,
    endpoint,
    streams,
    names,
    position,
    batch_size,
    retries,
    retry_timeout_secs
  }: SubscriptionWithEndpoint): Promise<SubscriptionState> => {
    const pushUrl = new URL(endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory) throw Error(`Cannot resolve push ${endpoint}`);

    const endpoints = await getServiceEndpoints(pushUrl);
    const found =
      endpoints &&
      endpoints.eventHandlers &&
      Object.values(endpoints.eventHandlers).find(
        (e) => e.path === "/".concat(path)
      );

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
        icon: active ? "bi-activity" : "",
        status: "OK"
      },
      stats: { batches: 0, total: 0, events: {} },
      events: found ? found.events : []
    };
  };

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
          const { status, statusText, details } =
            subState.streamsRegExp.test(e.stream) &&
            subState.namesRegExp.test(e.name)
              ? await subState.pushChannel.push(e)
              : { status: 204, statusText: "Not Matched", details: undefined };

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
              icon: "bi-activity",
              status: statusText || "OK",
              error: undefined
            };
          } else {
            const retryable = RetryableHttpStatus.includes(status);
            subState.endpointStatus = {
              name: e.name,
              code: status,
              color: retryable ? "warning" : "danger",
              icon: "bi-cone-striped",
              status: statusText || "Retryable Error",
              error: {
                trigger: `${triggerLog(trigger, e.id)}`,
                message: details,
                position: e.id
              }
            };
            sendState(subState);
            return retryable && (trigger.retry_count || 0) < subState.retries;
          }
        }
        sendState(subState);
      }
    } catch (error) {
      log().error(error);
      subState.endpointStatus = {
        name: undefined,
        code: 500,
        color: "danger",
        icon: "bi-cone-striped",
        status: "Internal Server Error",
        error: {
          trigger: `${triggerLog(trigger, subState.position)}`,
          message: error.message,
          position: subState.position
        }
      };
      sendState(subState);
      await dispose()(ExitCodes.ERROR);
    }
  };

  const pumpRetry = async (
    subState: SubscriptionState,
    trigger: TriggerPayload
  ): Promise<void> => {
    if (subState.pumping) return;
    try {
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
    } catch (error) {
      log().error(error);
      if (error instanceof Error) {
        subState.endpointStatus = {
          name: undefined,
          code: 500,
          color: "danger",
          icon: "bi-cone-striped",
          status: "Internal Server Error",
          error: {
            message: error.message,
            position: subState.position
          }
        };
        sendState(subState);
      }
    } finally {
      subState.pumping = false;
    }
  };

  const pumpChannel: TriggerCallback = (trigger) => {
    sendTrigger(trigger);
    for (const sub of Object.values(subStates)) {
      void pumpRetry(sub, trigger);
    }
  };

  process.on(
    "message",
    async ({ operation, sub }: MasterMessage): Promise<void> => {
      const currentState = subStates[sub.id];
      if (operation === "REFRESH") {
        currentState && sendState(currentState);
        return;
      }

      currentState &&
        currentState.retryTimeout &&
        clearTimeout(currentState.retryTimeout);

      if (!sub.active || operation === "DELETE") delete subStates[sub.id];
      else {
        const subState = (subStates[sub.id] = await toState(sub));
        currentState && Object.assign(subState.stats, currentState.stats);
        const trigger: TriggerPayload = { operation, id: sub.id };
        sendTrigger(trigger);
        void pumpRetry(subState, trigger);
      }
      !Object.keys(subStates).length && (await dispose()(ExitCodes.ERROR));
    }
  );

  try {
    const pullUrl = new URL(config.channel);
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory) throw Error(`Cannot resolve pull ${config.channel}`);
    pullchannel(pullFactory(pullUrl, config.id));
    await Promise.all(
      Object.values(config.subscriptions).map(async (sub) => {
        subStates[sub.id] = await toState(sub);
        sendState(subStates[sub.id]);
      })
    );
    pumpChannel({ operation: "RESTART", id: config.id });
    await pullchannel().listen(pumpChannel);
    return subStates;
  } catch (error) {
    log().error(error);
    error instanceof Error && sendError(error.message);
    await dispose()(ExitCodes.ERROR);
  }
};
