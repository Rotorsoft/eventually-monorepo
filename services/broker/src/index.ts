import {
  broker,
  PostgresSubscriptionStore,
  subscriptions
} from "@rotorsoft/eventually-broker";

subscriptions(PostgresSubscriptionStore());
void broker({ resolvers: { pull: {}, push: {} } });
