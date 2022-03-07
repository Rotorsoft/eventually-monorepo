import { CommittedEvent, Payload, Store } from "@rotorsoft/eventually";
import { Request, Response } from "express";

export type Stats = {
  after: number;
  batches: number;
  total: number;
  events: Record<string, Record<number, number>>;
};

export type Channel = {
  open: (req: Request, res: Response) => void;
  emit: (event: CommittedEvent<string, Payload>) => void;
};

export type Broker = {
  master: () => Promise<void>;
  worker: (factory: (table: string) => Store) => Promise<void>;
  channel: (name: string) => Channel;
};
