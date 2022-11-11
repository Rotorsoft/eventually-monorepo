import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";
import {
  ChildProcess,
  Serializable,
  SendHandle,
  MessageOptions
} from "child_process";
import { Worker } from "cluster";
import { EventEmitter } from "stream";
import { Service, Subscription, subscriptions } from "..";

export const serviceBody = (
  id: string,
  channel = "pg://channel",
  url = "http://url"
): Service => ({
  id,
  channel,
  url,
  position: -1,
  updated: new Date()
});

export const subscriptionBody = (
  id: string,
  producer = "s1",
  consumer = "s1",
  active = false
): Subscription => ({
  id,
  producer,
  consumer,
  path: "path",
  active,
  streams: ".*",
  names: ".*",
  position: -1,
  updated: new Date(),
  batch_size: 100,
  retries: 3,
  retry_timeout_secs: 10,
  endpoint: "http://url/path"
});

export const createService = (id: string): Promise<void> =>
  subscriptions().createService(serviceBody(id));

export const createSubscription = (
  id: string,
  service: string
): Promise<void> =>
  subscriptions().createSubscription(subscriptionBody(id, service, service));

export const createCommittedEvent = (
  id = 0,
  name = "name",
  stream = "stream"
): CommittedEvent<string, Payload> => ({
  id,
  name,
  stream,
  version: 0,
  created: new Date()
});

export const get = (
  path: string,
  port: number
): Promise<AxiosResponse<any, any>> => {
  const url = `http://localhost:${port}${path}`;
  return axios.get<any>(url);
};

export const post = async (
  path: string,
  body: Record<string, unknown>,
  port: number
): Promise<AxiosResponse<any, any>> => {
  try {
    const url = `http://localhost:${port}${path}`;
    const response = await axios.post<any>(url, body);
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const put = async (
  path: string,
  body: Record<string, unknown>,
  port: number
): Promise<AxiosResponse<any, any>> => {
  try {
    const url = `http://localhost:${port}${path}`;
    const response = await axios.put<any>(url, body);
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const _delete = (
  path: string,
  port: number
): Promise<AxiosResponse<any, any>> => {
  const url = `http://localhost:${port}${path}`;
  return axios.delete<any>(url);
};

export class FakeChildProcess extends EventEmitter implements Worker {
  constructor(_id: number) {
    super();
    this.id = _id;
  }

  id: number;
  process: ChildProcess;
  send(message: Serializable, callback?: (error: Error) => void): boolean;
  send(
    message: Serializable,
    sendHandle: SendHandle,
    callback?: (error: Error) => void
  ): boolean;
  send(
    message: Serializable,
    sendHandle: SendHandle,
    options?: MessageOptions,
    callback?: (error: Error) => void
  ): boolean;
  send(): boolean {
    throw new Error("Method not implemented.");
  }
  kill(): void {
    throw new Error("Method not implemented.");
  }
  destroy(): void {
    throw new Error("Method not implemented.");
  }
  disconnect(): void {
    throw new Error("Method not implemented.");
  }
  isConnected(): boolean {
    throw new Error("Method not implemented.");
  }
  isDead(): boolean {
    throw new Error("Method not implemented.");
  }
  exitedAfterDisconnect: boolean;
}
