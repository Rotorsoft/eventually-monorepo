import { CommittedEvent, log, Payload, store } from "@rotorsoft/eventually";
import axios from "axios";

const BATCH_SIZE = 100;
// TODO store watermarks in db (redis?)
let watermark = -1;

type Response = {
  status: number;
  statusText: string;
};
const post = async (
  event: CommittedEvent<string, Payload>,
  endpoint: string,
  streams: RegExp,
  names: RegExp
): Promise<Response> => {
  if (streams.test(event.stream) && names.test(event.name)) {
    try {
      const response = await axios.post(endpoint, event);
      const { status, statusText } = response;
      return { status, statusText };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const { status, statusText } = error.response;
        // TODO retry logic on connection errors (400 range?)
        // TODO make this an option of the subscription?
        if (status === 409) return { status, statusText }; // ignore concurrency errors
      } else {
        log().error(error);
        return { status: 500, statusText: error.message };
      }
    }
  }
  return { status: 404, statusText: "Not Matched" };
};

/**
 * Pumps committed events from streams to endpoints
 * @param event triggering event
 * @param channel the streaming channel
 * @param endpoint HTTP POST endpoint
 * @param streams streams regex to match
 * @param names names regex to match
 */
export const pump = async (
  trigger: CommittedEvent<string, Payload>,
  channel: string,
  endpoint: string,
  streams: RegExp,
  names: RegExp
): Promise<void> => {
  let count = BATCH_SIZE;
  const stats: {
    trigger: { id: number; name: string };
    after: number;
    last: number;
    batches: number;
    total: number;
    events: Record<string, { count: number; response: Record<number, number> }>;
  } = {
    trigger: { id: trigger.id, name: trigger.name },
    after: watermark,
    last: watermark,
    batches: 0,
    total: 0,
    events: {}
  };
  while (count === BATCH_SIZE) {
    stats.batches++;
    const events: CommittedEvent<string, Payload>[] = [];
    count = await store().query((e) => events.push(e), {
      after: watermark,
      limit: BATCH_SIZE
    });
    for (const e of events) {
      const response = await post(e, endpoint, streams, names);
      stats.total++;
      const event = (stats.events[e.name] = stats.events[e.name] || {
        count: 0,
        response: {}
      });
      event.count++;
      event.response[response.status] =
        (event.response[response.status] || 0) + 1;
      if (response.status >= 500) break;
      watermark = stats.last = e.id;
    }
  }
  log().info("blue", `${channel} -> ${endpoint}`, JSON.stringify(stats));
};
