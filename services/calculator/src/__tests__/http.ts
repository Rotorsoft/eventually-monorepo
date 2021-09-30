import {
  AggregateFactory,
  aggregatePath,
  commandPath,
  eventPath,
  Evt,
  EvtOf,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string): string => `http://localhost:3000${path}`;

export const command = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string,
  msg: MsgOf<C>,
  expectedVersion?: string
): Promise<Snapshot<M>[]> => {
  const { data } = await axios.post<MsgOf<C>, AxiosResponse<Snapshot<M>[]>>(
    url(commandPath(factory, msg).replace(":id", id)),
    msg,
    { headers: expectedVersion ? { "If-Match": expectedVersion } : {} }
  );
  return data;
};

export const event = async <C, E>(
  factory: PolicyFactory<C, E>,
  event: EvtOf<E>
): Promise<PolicyResponse<C> | undefined> => {
  const { data } = await axios.post<
    MsgOf<C>,
    AxiosResponse<PolicyResponse<C> | undefined>
  >(url(eventPath(factory, event)), event);
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
