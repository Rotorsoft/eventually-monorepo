import {
  CommittedEvent,
  dispose,
  ExitCodes,
  log,
  Payload
} from "@rotorsoft/eventually";
import {
  ChannelResolvers,
  pullchannel,
  PushEvent,
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

  const toState = async ({
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
  }: SubscriptionWithEndpoint): Promise<SubscriptionState> => {
    const pushUrl = new URL(endpoint);
    const pushFactory = resolvers.push[pushUrl.protocol];
    if (!pushFactory) throw Error(`Cannot resolve push ${endpoint}`);
    const pushChannel = pushFactory(pushUrl, id);
    await pushChannel.init();

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
      pushChannel,
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

  const ignore = (
    subState: SubscriptionState,
    event: CommittedEvent<string, Payload>
  ): boolean =>
    !(
      subState.streamsRegExp.test(event.stream) &&
      subState.namesRegExp.test(event.name)
    );

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
        subState.endpointStatus.name = undefined;
        const events = (await pullchannel().pull(
          subState.position,
          subState.batchSize
        )) as PushEvent[];
        count = events.length;

        log().trace(
          "magenta",
          `[${process.pid}] pulled ${subState.id} ${count} events @ ${subState.position} [${subState.batchSize}]`
        );
        if (!count) break;

        const batch = events.filter((event) => {
          const ignored = ignore(subState, event);
          ignored && (event.response = { statusCode: 204 });
          return !ignored;
        });
        batch.length && (await subState.pushChannel.push(batch));

        let lastResponse: PushEvent, lastCommittable: PushEvent;
        for (const event of events) {
          if (!event.response) break;
          lastResponse = event;
          CommittableHttpStatus.includes(event.response.statusCode) &&
            (lastCommittable = event);

          subState.stats.total++;
          const entry = (subState.stats.events[event.name] =
            subState.stats.events[event.name] || {});
          const stat = (entry[event.response.statusCode] = entry[
            event.response.statusCode
          ] || {
            count: 0,
            min: Number.MAX_SAFE_INTEGER,
            max: -1
          });
          stat.count++;
          stat.min = Math.min(stat.min, event.id);
          stat.max = Math.max(stat.max, event.id);
        }

        if (lastCommittable) {
          await subscriptions().commitSubscriptionPosition(
            subState.id,
            lastCommittable.id
          );
          subState.position = lastCommittable.id;
        }

        subState.endpointStatus = {
          name:
            lastResponse.response.statusCode !== 204 ? lastResponse.name : "",
          code: lastResponse.response.statusCode,
          color: "success",
          icon: "bi-activity",
          status: lastResponse.response.statusText || "OK"
        };

        if (lastCommittable !== lastResponse) {
          const retryable = RetryableHttpStatus.includes(
            lastResponse.response.statusCode
          );
          subState.endpointStatus.color = retryable ? "warning" : "danger";
          subState.endpointStatus.icon = "bi-cone-striped";
          subState.endpointStatus.error = {
            trigger: `${triggerLog(trigger, lastResponse.id)}`,
            message: lastResponse.response.details,
            position: lastResponse.id
          };
          sendState(subState);
          return retryable && (trigger.retry_count || 0) < subState.retries;
        }

        // send batch state and continue pumping until the end of the stream
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
        const subState = (subStates[sub.id] = await toState(sub));
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
    await Promise.all(
      Object.values(config.subscriptions).map(async (sub) => {
        subStates[sub.id] = await toState(sub);
        sendState(subStates[sub.id], false);
      })
    );
    pumpChannel({ operation: "RESTART", id: config.id });
    await pullchannel().listen(pumpChannel);
  } catch (error) {
    log().error(error);
    process.send({ error: { message: error.message } });
    process.exit(0);
  }
};
