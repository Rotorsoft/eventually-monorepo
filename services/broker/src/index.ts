import { ChannelResolvers, subscriptions } from "@rotorsoft/eventually";
import {
  broker,
  postPushChannel,
  ssePushChannel
} from "@rotorsoft/eventually-express";
import {
  PostgresPullChannel,
  PostgresStreamListenerFactory,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-pg";

subscriptions(PostgresSubscriptionStore());
const resolvers: ChannelResolvers = {
  "pg:": {
    pull: (id: string, channel: URL) => PostgresPullChannel(id, channel),
    push: undefined
  },
  "http:": {
    pull: undefined,
    push: (_, endpoint: URL) => postPushChannel(endpoint)
  },
  "sse:": {
    pull: undefined,
    push: () => ssePushChannel()
  }
};

void broker(PostgresStreamListenerFactory, resolvers);
