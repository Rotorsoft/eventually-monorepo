import {
  CommittedEvent,
  dispose,
  ExitCodes,
  log,
  Payload
} from "@rotorsoft/eventually";
import {
  AppOptions,
  Operation,
  pullchannel,
  PushEvent,
  Subscription,
  subscriptions,
  TriggerCallback,
  TriggerPayload
} from "..";
import { formatDate, Loop, loop } from "../utils";
import {
  WorkerConfig,
  CommittableHttpStatus,
  MasterMessage,
  RetryableHttpStatus,
  SubscriptionState
} from "./types";

let channel_position = -1;
const triggerLog = (
  operation: Operation,
  retry_count: number,
  position: number
): string =>
  `${operation}${
    retry_count || ""
  } [${position}/${channel_position}] ${formatDate(new Date())}`;

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

type Sub = {
  state: SubscriptionState;
  loop: Loop;
  retry_count: number;
};

export const work = async (options: AppOptions): Promise<void> => {
  const config = JSON.parse(process.env.WORKER_ENV) as WorkerConfig;
  const masterLoop = loop(config.id);
  const subs: Record<string, Sub> = {};
  let refreshTimer: NodeJS.Timeout;

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
  }: Subscription): Promise<SubscriptionState> => {
    const pushUrl = new URL(endpoint);
    const pushFactory = options.resolvers.push[pushUrl.protocol];
    if (!pushFactory) throw Error(`Cannot resolve push ${endpoint}`);
    const pushChannel = pushFactory(
      pushUrl,
      id,
      producer,
      options?.secrets?.bySubscription && options.secrets.bySubscription[id]
    );
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

  // returns true to retry
  const pullPush = async (
    id: string,
    trigger: TriggerPayload
  ): Promise<boolean | undefined> => {
    const sub = subs[id];
    if (!sub || !sub.state.active) return;

    process.send({ trigger });
    const { state, loop } = sub;
    log().info(
      "blue",
      `[${process.pid}] ⚡ pull ${state.id} ${JSON.stringify({
        ...trigger,
        retry: sub.retry_count
      })}`
    );
    try {
      channel_position = Math.max(channel_position, state.position);
      if (trigger.position > channel_position) {
        await subscriptions().commitServicePosition(
          config.id,
          trigger.position
        );
        channel_position = trigger.position;
      }

      let count = state.batchSize;
      while (count === state.batchSize && !loop.stopped()) {
        // pull events
        state.stats.batches++;
        state.endpointStatus.name = undefined;
        const events = (await pullchannel().pull({
          operation: trigger.operation,
          position: state.position,
          limit: state.batchSize
        })) as PushEvent[];
        count = events.length;
        log().trace(
          "magenta",
          `[${process.pid}] pulled ${state.id} ${count} events @ ${state.position} [${state.batchSize}]`
        );
        if (!count) break;

        // filter ignored
        const batch = events.filter((event) => {
          const ignored = ignore(state, event);
          ignored && (event.response = { statusCode: 204 });
          return !ignored;
        });

        // push events
        batch.length && (await state.pushChannel.push(batch));

        let lastResponse: PushEvent, lastCommittable: PushEvent;
        for (const event of events) {
          if (!event.response) break;
          lastResponse = event;

          state.stats.total++;
          const entry = (state.stats.events[event.name] =
            state.stats.events[event.name] || {});
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

          if (CommittableHttpStatus.includes(event.response.statusCode))
            lastCommittable = event;
          else break; // stop after first non-committable response
        }

        if (lastCommittable) {
          await subscriptions().commitSubscriptionPosition(
            state.id,
            lastCommittable.id
          );
          state.position = lastCommittable.id;
        }

        state.endpointStatus = {
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
          state.endpointStatus.color = retryable ? "warning" : "danger";
          state.endpointStatus.icon = "bi-cone-striped";
          state.endpointStatus.error = {
            trigger: `${triggerLog(
              trigger.operation,
              sub.retry_count,
              lastResponse.id
            )}`,
            messages:
              (lastResponse.response?.details && [
                lastResponse.response.details
              ]) ||
              [],
            position: lastResponse.id
          };
          sendState(state);
          return retryable;
        }

        // send batch state and continue pumping until the end of the stream
        sub.retry_count = 0;
        sendState(state);
      }
    } catch (error) {
      log().error(error);
      state.endpointStatus = {
        name: undefined,
        code: 500,
        color: "danger",
        icon: "bi-cone-striped",
        status: "Internal Server Error",
        error: {
          trigger: `${triggerLog(
            trigger.operation,
            sub.retry_count,
            state.position
          )}`,
          messages: [error.message],
          position: state.position
        }
      };
      sendState(state);
      await exit();
    }
  };

  const pump = (sub: Sub, trigger: TriggerPayload, delay?: number): void => {
    const id = sub.state.id;
    sub.loop.push({
      id,
      action: () => pullPush(id, trigger),
      callback: (id, retryable) => {
        if (retryable) retry(id);
        else sub.retry_count = 0;
      },
      delay
    });
  };

  const retry = (id: string): void => {
    const sub = subs[id];
    if (!sub) return;
    if (sub.retry_count < sub.state.retries) {
      sub.retry_count++;
      const trigger: TriggerPayload = {
        operation: "RETRY",
        id,
        position: sub.state.position
      };
      pump(sub, trigger, sub.state.retryTimeoutSecs * 1000 * sub.retry_count);
    }
  };

  const pumpChannel: TriggerCallback = (trigger) => {
    Object.values(subs).forEach((sub) => {
      sub.retry_count = 0;
      pump(sub, trigger);
    });
  };

  const masterMessage = async ({
    sub,
    operation
  }: MasterMessage): Promise<boolean | undefined> => {
    const current = subs[sub.id];
    if (current) {
      await current.loop.stop();
      current.state.active = sub.active;
      current.state.position = sub.position;
      sendState(current.state, false);
      if (!sub.active || operation === "DELETE") {
        delete subs[sub.id];
        !Object.keys(subs).length && exit();
        return;
      }
    }
    try {
      const state = await toState(sub);
      current && Object.assign(state.stats, current.state.stats);
      const refresh = (subs[sub.id] = subs[sub.id] || {
        state,
        loop: loop(sub.id),
        retry_count: 0
      });
      refresh.state = state;
      refresh.retry_count = 0;
      pump(refresh, { operation, id: sub.id });
    } catch (error) {
      log().error(error);
    }
  };

  const exit = async (): Promise<void> => {
    await dispose()(ExitCodes.ERROR);
  };

  dispose(async () => {
    clearInterval(refreshTimer);
    await Promise.all(Object.values(subs).map((sub) => sub.loop.stop()));
    await masterLoop.stop();
  });

  process.on("message", (msg: MasterMessage) => {
    if (msg.operation === "REFRESH") {
      const sub = subs[msg.sub.id];
      sub && sendState(sub.state, false);
    } else
      masterLoop.push({ id: msg.sub.id, action: () => masterMessage(msg) });
  });

  try {
    const pullUrl = new URL(encodeURI(config.channel));
    const pullFactory = options.resolvers.pull[pullUrl.protocol];
    if (!pullFactory) throw Error(`Cannot resolve pull ${config.channel}`);
    pullchannel(pullFactory(pullUrl, config.id));
    await Promise.all(
      Object.values(config.subscriptions).map(async (sub) => {
        const s = (subs[sub.id] = {
          state: await toState(sub),
          loop: loop(sub.id),
          retry_count: 0
        });
        sendState(s.state, false);
      })
    );
    pumpChannel({ operation: "RESTART", id: config.id });
    refreshTimer = setInterval(
      () => pumpChannel({ operation: "REFRESH", id: config.id }),
      10 * 60 * 1000
    );
    await pullchannel().listen(pumpChannel);
  } catch (error) {
    log().error(error);
    process.send({ error: { message: error.message } });
    process.exit(0);
  }
};
