import {
  AllQuery,
  Command,
  CommandHandlerFactory,
  commandHandlerPath,
  CommittedEvent,
  EventHandlerFactory,
  eventHandlerPath,
  Message,
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
  command: Command<keyof C & string, Payload>,
  port?: number,
  headers: Record<string, string> = {}
): Promise<Snapshot<M>[]> => {
  command.expectedVersion &&
    (headers["If-Match"] = command.expectedVersion.toString());
  const { data } = await axios.post<Payload, AxiosResponse<Snapshot<M>[]>>(
    url(
      commandHandlerPath(handler, command.name).replace(":id", command.id),
      port
    ),
    command.data || {},
    { headers }
  );
  return data;
};

export const event = async <M extends Payload, C, E>(
  handler: EventHandlerFactory<M, C, E>,
  event: Message<keyof E & string, Payload>,
  port?: number
): Promise<Message<keyof C & string, Payload> | undefined> => {
  const { data } = await axios.post<
    Payload,
    AxiosResponse<Message<keyof C & string, Payload> | undefined>
  >(url(eventHandlerPath(handler), port), event);
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
