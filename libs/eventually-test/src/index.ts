import {
  AllQuery,
  CommandHandlerFactory,
  commandHandlerPath,
  CommittedEvent,
  EventHandlerFactory,
  eventHandlerPath,
  Message,
  MessageOptions,
  Payload,
  ReducibleFactory,
  reduciblePath,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string, port?: number): string =>
  `http://localhost:${port || 3000}${path}`;

export const get = (path: string, port?: number): Promise<AxiosResponse<any>> =>
  axios.get<any>(url(path, port));

export const command = async <M extends Payload, C, E>(
  handler: CommandHandlerFactory<M, C, E>,
  command: MessageOptions<string, Payload>,
  payload?: Payload,
  id?: string,
  expectedVersion?: number,
  port?: number
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.post<Payload, AxiosResponse<Snapshot<M>[]>>(
    url(commandHandlerPath(handler, command.name).replace(":id", id), port),
    payload || {},
    {
      headers: expectedVersion ? { "If-Match": expectedVersion.toString() } : {}
    }
  );
  return data;
};

export const event = async <M extends Payload, C, E>(
  handler: EventHandlerFactory<M, C, E>,
  event: MessageOptions<string, Payload>,
  payload?: Payload,
  port?: number
): Promise<Message<keyof C & string, Payload> | undefined> => {
  const { data } = await axios.post<
    Payload,
    AxiosResponse<Message<keyof C & string, Payload> | undefined>
  >(url(eventHandlerPath(handler, event.name), port), payload);
  return data;
};

export const load = async <M extends Payload, C, E>(
  reducible: ReducibleFactory<M, C, E>,
  id: string,
  port?: number
): Promise<Snapshot<M>> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>>>(
    url(reduciblePath(reducible).replace(":id", id), port)
  );
  return data;
};

export const stream = async <M extends Payload, C, E>(
  reducible: ReducibleFactory<M, C, E>,
  id: string,
  options: {
    port?: number;
    useSnapshots?: boolean;
  } = { useSnapshots: false }
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>[]>>(
    url(
      reduciblePath(reducible)
        .replace(":id", id)
        .concat(`/stream${options.useSnapshots ? "?useSnapshots=true" : ""}`),
      options.port
    )
  );
  return data;
};

export const read = async (
  query: AllQuery = { after: -1, limit: 1 },
  port?: number
): Promise<CommittedEvent<string, Payload>[]> => {
  const { data } = await axios.get<
    any,
    AxiosResponse<CommittedEvent<string, Payload>[]>
  >(url("/all", port), {
    params: query
  });
  return data;
};

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
