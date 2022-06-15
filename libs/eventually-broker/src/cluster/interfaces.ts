import { Disposable } from "@rotorsoft/eventually";
import { Writable } from "stream";
import { Operation, Service } from "../types";
import { SubscriptionViewModel, WorkerMessage } from "./types";

export type StateOptions = { serviceLogLinkTemplate?: string };

export interface State extends Disposable {
  init: (services: Service[], options: StateOptions) => Promise<void>;
  serviceLogLink: (id: string) => string;
  refreshService: (operation: Operation, id: string) => Promise<void>;
  refreshSubscription: (operation: Operation, id: string) => Promise<void>;
  subscribeSSE: (session: string, stream: Writable, id?: string) => void;
  unsubscribeSSE: (session: string) => void;
  services: () => Service[];
  viewModel: (id: string) => SubscriptionViewModel;
  onMessage: (workerId: number, message: WorkerMessage) => void;
  onExit: (workerId: number, code: number, signal: string) => void;
}
