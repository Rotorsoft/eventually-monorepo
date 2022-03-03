import { subscriptions } from "@rotorsoft/eventually";
import { broker } from "@rotorsoft/eventually-express";
import { PostgresSubscriptionStore } from "@rotorsoft/eventually-pg";
import cluster from "cluster";

subscriptions(PostgresSubscriptionStore());

cluster.isWorker ? void broker().worker() : void broker().master();
