import { subscriptions } from "@rotorsoft/eventually";
import { broker } from "@rotorsoft/eventually-express";
import {
  PostgresStore,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-pg";
import cluster from "cluster";

subscriptions(PostgresSubscriptionStore());

cluster.isWorker ? void broker().worker(PostgresStore) : void broker().master();
