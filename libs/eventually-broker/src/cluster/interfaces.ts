import { Disposable } from "@rotorsoft/eventually";
import { Request, Response } from "express";
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
  sse: (req: Request, res: Response) => void;
  services: () => Service[];
  viewModel: (sub: Subscription) => SubscriptionViewModel;
  onMessage: (workerId: number, message: WorkerMessage) => void;
  onExit: (workerId: number, code: number, signal: string) => void;
  state: () => Array<WorkerConfig>;
}
