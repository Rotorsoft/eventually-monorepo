import {
  externalSystemCommandPath,
  ExternalSystemFactory,
  MsgOf,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

const url = (path: string): string => `http://localhost:3000${path}`;

export const command = async <C, E>(
  factory: ExternalSystemFactory<C, E>,
  msg: MsgOf<C>
): Promise<Snapshot<undefined>[]> => {
  const { data } = await axios.post<
    MsgOf<C>,
    AxiosResponse<Snapshot<undefined>[]>
  >(url(externalSystemCommandPath(factory, msg)), msg);
  return data;
};
