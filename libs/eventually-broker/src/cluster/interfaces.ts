import { Disposable } from "@andela-technology/eventually";
import { Writable } from "stream";
import { Operation, Service, Subscription } from "../types";
import {
  StateOptions,
  SubscriptionViewModel,
  WorkerConfig,
  WorkerMessage
} from "./types";

export interface State extends Disposable {
  init: (services: Service[], options: StateOptions) => Promise<void>;
  options: () => StateOptions;
  serviceSecretsQueryString: (id: string) => string;
  serviceLogLink: (id: string) => string;
  refreshService: (operation: Operation, id: string) => void;
  refreshSubscription: (operation: Operation, id: string) => void;
  subscribeSSE: (session: string, stream: Writable, id?: string) => void;
  unsubscribeSSE: (session: string) => void;
  services: () => Service[];
  viewModel: (sub: Subscription) => SubscriptionViewModel;
  onMessage: (workerId: number, message: WorkerMessage) => void;
  onExit: (workerId: number, code: number, signal: string) => void;
  state: () => Array<WorkerConfig>;
}
