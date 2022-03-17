import {
  broker,
  ChannelResolvers,
  PostgresPullChannel,
  PostgresStreamListenerFactory,
  PostgresSubscriptionStore,
  postPushChannel,
  subscriptions
} from "@rotorsoft/eventually-broker";

subscriptions(PostgresSubscriptionStore());
const resolvers: ChannelResolvers = {
  "pg:": {
    pull: (id: string, channel: URL) => PostgresPullChannel(id, channel),
    push: undefined
  },
  "http:": {
    pull: undefined,
    push: (_, endpoint: URL) => postPushChannel(endpoint)
  }
};

void broker(PostgresStreamListenerFactory, resolvers);
