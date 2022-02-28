import { Subscription } from "@rotorsoft/eventually";

type Channel = {
  subscriptions: Subscription[];
};

export type Channels = Record<string, Channel>;
