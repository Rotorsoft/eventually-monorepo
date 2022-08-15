import { Disposable } from "@rotorsoft/eventually";
import { Writable } from "stream";
import { ChannelResolvers } from "../interfaces";
import { Operation, Service, Subscription } from "../types";
import { SubscriptionViewModel, WorkerConfig, WorkerMessage } from "./types";

export type StateOptions = {
  resolvers: ChannelResolvers;
  serviceLogLinkTemplate?: string;
};

export type ServiceWithWorker = Service & { config?: WorkerConfig };

export interface State extends Disposable {
  init: (services: Service[], options: StateOptions) => Promise<void>;
  serviceLogLink: (id: string) => string;
  refreshService: (operation: Operation, id: string) => void;
  refreshSubscription: (operation: Operation, id: string) => void;
  subscribeSSE: (session: string, stream: Writable, id?: string) => void;
  unsubscribeSSE: (session: string) => void;
  services: () => Service[];
  discoverServices: () => void;
  discover: (service: Service) => Promise<void>;
  viewModel: (sub: Subscription) => SubscriptionViewModel;
  onMessage: (workerId: number, message: WorkerMessage) => void;
  onExit: (workerId: number, code: number, signal: string) => void;
  state: () => Array<WorkerConfig>;
}
