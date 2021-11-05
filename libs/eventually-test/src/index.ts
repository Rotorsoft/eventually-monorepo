import {
  AggregateFactory,
  AllQuery,
  MessageFactory,
  commandHandlerPath,
  CommandResponse,
  eventHandlerPath,
  Evt,
  ExternalSystemFactory,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  reduciblePath,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string, port?: number): string =>
  `http://localhost:${port || 3000}${path}`;

export const get = (path: string, port?: number): Promise<AxiosResponse<any>> =>
  axios.get<any>(url(path, port));

export const command = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ExternalSystemFactory<C, E>,
  command: MessageFactory<string, Payload>,
  payload?: Payload,
  id?: string,
  expectedVersion?: number,
  port?: number
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.post<Payload, AxiosResponse<Snapshot<M>[]>>(
    url(commandHandlerPath(factory, command.name).replace(":id", id), port),
    payload || {},
    {
      headers: expectedVersion ? { "If-Match": expectedVersion.toString() } : {}
    }
  );
  return data;
};

export const event = async <M extends Payload, C, E>(
  factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
  event: MessageFactory<string, Payload>,
  payload?: Payload,
  port?: number
): Promise<CommandResponse<C> | undefined> => {
  const { data } = await axios.post<
    Payload,
    AxiosResponse<CommandResponse<C> | undefined>
  >(url(eventHandlerPath(factory, event.name), port), payload);
  return data;
};

export const load = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ProcessManagerFactory<M, C, E>,
  id: string,
  port?: number
): Promise<Snapshot<M>> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>>>(
    url(reduciblePath(factory).replace(":id", id), port)
  );
  return data;
};

export const stream = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ProcessManagerFactory<M, C, E>,
  id: string,
  options: {
    port?: number;
    useSnapshots?: boolean;
  } = { useSnapshots: false }
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>[]>>(
    url(
      reduciblePath(factory)
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
): Promise<Evt[]> => {
  const { data } = await axios.get<any, AxiosResponse<Evt[]>>(
    url("/all", port),
    {
      params: query
    }
  );
  return data;
};

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
