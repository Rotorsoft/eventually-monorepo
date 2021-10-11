import {
  AggregateFactory,
  aggregatePath,
  Evt,
  EvtOf,
  ExternalSystemFactory,
  MsgOf,
  Payload,
  PolicyFactory,
  CommandResponse,
  Snapshot,
  commandHandlerPath,
  ProcessManagerFactory,
  eventHandlerPath
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string, port = 3000): string =>
  `http://localhost:${port}${path}`;

export const get = (path: string, port = 3000): Promise<void> =>
  axios.get(url(path, port));

export const command = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ExternalSystemFactory<C, E>,
  msg: MsgOf<C>,
  id?: string,
  expectedVersion?: number,
  port = 3000
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.post<MsgOf<C>, AxiosResponse<Snapshot<M>[]>>(
    url(commandHandlerPath(factory, msg).replace(":id", id), port),
    msg,
    {
      headers: expectedVersion ? { "If-Match": expectedVersion.toString() } : {}
    }
  );
  return data;
};

export const event = async <M extends Payload, C, E>(
  factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
  event: EvtOf<E>
): Promise<CommandResponse<C> | undefined> => {
  const { data } = await axios.post<
    EvtOf<E>,
    AxiosResponse<CommandResponse<C> | undefined>
  >(url(eventHandlerPath(factory, event)), event);
  return data;
};

export const load = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string
): Promise<Snapshot<M>> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>>>(
    url(aggregatePath(factory).path.replace(":id", id))
  );
  return data;
};

export const stream = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.get<any, AxiosResponse<Snapshot<M>[]>>(
    url(aggregatePath(factory).path.replace(":id", id).concat("/stream"))
  );
  return data;
};

export const read = async (options?: {
  name?: string;
  after?: number;
  limit?: number;
}): Promise<Evt[]> => {
  const { name, after, limit } = options || {};
  const { data } = await axios.get<any, AxiosResponse<Evt[]>>(
    url("/stream".concat(name ? `/${name}` : "")),
    {
      params: { after, limit }
    }
  );
  return data;
};

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
