import {
  aggregateCommandPath,
  AggregateFactory,
  aggregatePath,
  Evt,
  EvtOf,
  externalSystemCommandPath,
  ExternalSystemFactory,
  MsgOf,
  Payload,
  policyEventPath,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string, port = 3000): string =>
  `http://localhost:${port}${path}`;

export const get = (path: string, port = 3000): Promise<void> =>
  axios.get(url(path, port));

export const command = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string,
  msg: MsgOf<C>,
  expectedVersion?: number,
  port = 3000
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.post<MsgOf<C>, AxiosResponse<Snapshot<M>[]>>(
    url(aggregateCommandPath(factory, msg).replace(":id", id), port),
    msg,
    {
      headers: expectedVersion ? { "If-Match": expectedVersion.toString() } : {}
    }
  );
  return data;
};

export const system = async <C, E>(
  factory: ExternalSystemFactory<C, E>,
  msg: MsgOf<C>,
  port: number
): Promise<Snapshot<undefined>[]> => {
  const { data } = await axios.post<
    MsgOf<C>,
    AxiosResponse<Snapshot<undefined>[]>
  >(url(externalSystemCommandPath(factory, msg), port), msg);
  return data;
};

export const event = async <C, E, M extends Payload>(
  factory: PolicyFactory<C, E, M>,
  event: EvtOf<E>
): Promise<PolicyResponse<C> | undefined> => {
  const { data } = await axios.post<
    EvtOf<E>,
    AxiosResponse<PolicyResponse<C> | undefined>
  >(url(policyEventPath(factory, event)), event);
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