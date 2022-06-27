import { dispose, ExitCodes, log } from "@rotorsoft/eventually";
import {
  ChannelResolvers,
  pullchannel,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "..";
import { formatDate } from "../utils";
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

const sendState = (state: SubscriptionState, logit = true): void => {
  logit &&
    log().info(
      "blue",
      `[${process.pid}] 📊${state.id} at=${state.position} total=${state.stats.total} batches=${state.stats.batches}`,
      JSON.stringify(state.stats.events),
      JSON.stringify(state.endpointStatus)
    );
  process.send({ state });
};

export const work = async (resolvers: ChannelResolvers): Promise<void> => {
  const config = JSON.parse(process.env.WORKER_ENV) as ChannelConfig;
  const subStates: Record<string, SubscriptionState> = {};
  const retryTimeouts: Record<string, NodeJS.Timeout> = {};

  const exit = async (): Promise<void> => {
    await dispose()(ExitCodes.ERROR);
  };

  dispose(() => {
    Object.values(retryTimeouts).forEach((t) => {
      clearTimeout(t);
    });
    return Promise.resolve();
  });

  const toState = ({
    id,
    producer,
    consumer,
    path,
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
    return {
      id,
      producer,
      consumer,
      path,
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
      endpointStatus: {
        name: "",
        code: 200,
        color: "success",
        icon: active ? "bi-activity" : "",
        status: "OK"
      },
      stats: { batches: 0, total: 0, events: {} }
    };
  };

  const pumpSub = async (
    subState: SubscriptionState,
    trigger: TriggerPayload
  ): Promise<boolean> => {
    process.send({ trigger });
    log().info(
      "blue",
      `[${process.pid}] ⚡ pump ${subState.id} ${JSON.stringify(trigger)}`
    );
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
        if (subState.cancel) return;
        subState.stats.batches++;
        const events = await pullchannel().pull(
          subState.position,
          subState.batchSize
        );
        log().trace(
          "magenta",
          `[${process.pid}] pull ${subState.id} ${events.length} events @ ${subState.position} [${subState.batchSize}]`
        );
        count = events.length;
        for (const e of events) {
          if (subState.cancel) return;
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
      await exit();
    }
  };

  const pumpRetry = async (
    subState: SubscriptionState,
    trigger: TriggerPayload
  ): Promise<void> => {
    if (subState.pumping) return;
    if (!subState.active) return;
    try {
      subState.pumping = true;
      clearTimeout(retryTimeouts[subState.id]);
      const retry = await pumpSub(subState, trigger);
      const retry_count = (trigger.retry_count || 0) + 1;
      retry &&
        (retryTimeouts[subState.id] = setTimeout(() => {
          const retry_trigger: TriggerPayload = {
            operation: "RETRY",
            id: trigger.id,
            retry_count,
            position: trigger.position
          };
          void pumpRetry(subState, retry_trigger);
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
    for (const sub of Object.values(subStates)) {
      void pumpRetry(sub, trigger);
    }
  };

  process.on(
    "message",
    async ({ operation, sub }: MasterMessage): Promise<void> => {
      const currentState = subStates[sub.id];
      if (currentState) {
        if (operation === "REFRESH") {
          sendState(currentState, false);
          return;
        }

        clearTimeout(retryTimeouts[currentState.id]);
        let i = 0;
        while (currentState.pumping && i <= 10) {
          log().info("red", `Trying (${++i}) to stop pump on ${sub.id}...`);
          currentState.cancel = true;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        currentState.cancel = false;
        currentState.active = sub.active;
        if (!sub.active || operation === "DELETE") {
          delete subStates[sub.id];
          !Object.keys(subStates).length && exit();
          return;
        }
      }
      try {
        const subState = (subStates[sub.id] = toState(sub));
        currentState && Object.assign(subState.stats, currentState.stats);
        const trigger: TriggerPayload = { operation, id: sub.id };
        void pumpRetry(subState, trigger);
      } catch (error) {
        log().error(error);
      }
    }
  );

  try {
    const pullUrl = new URL(encodeURI(config.channel));
    const pullFactory = resolvers.pull[pullUrl.protocol];
    if (!pullFactory) throw Error(`Cannot resolve pull ${config.channel}`);
    pullchannel(pullFactory(pullUrl, config.id));
    Object.values(config.subscriptions).map((sub) => {
      subStates[sub.id] = toState(sub);
      sendState(subStates[sub.id], false);
    });
    pumpChannel({ operation: "RESTART", id: config.id });
    await pullchannel().listen(pumpChannel);
  } catch (error) {
    log().error(error);
    process.send({ error: { message: error.message } });
    process.exit(0);
  }
};
