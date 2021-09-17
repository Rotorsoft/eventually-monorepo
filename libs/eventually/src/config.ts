import * as joi from "joi";
import * as dotenv from "dotenv";

dotenv.config();

const ENVIRONMENTS = ["development", "test", "staging", "production"] as const;
type Environments = typeof ENVIRONMENTS[number];

const BUSES = ["in-memory", "pubsub", "redis"] as const;
type Buses = typeof BUSES[number];

const STORES = ["in-memory", "firestore", "redis"] as const;
type Stores = typeof STORES[number];

const FRAMEWORKS = ["express"] as const;
type Frameworks = typeof FRAMEWORKS[number];

type GcpConfig = {
  project: string;
  keyfilename?: string;
};

type Config = {
  env: Environments;
  host: string;
  port: number;
  bus: Buses;
  store: Stores;
  app: Frameworks;
  gcp?: GcpConfig;
};

const schema = joi.object<Config>({
  env: joi
    .string()
    .required()
    .valid(...ENVIRONMENTS),
  host: joi.string().required().min(5),
  port: joi.number().integer().required().min(3000).max(9000),
  bus: joi
    .string()
    .required()
    .valid(...BUSES),
  store: joi
    .string()
    .required()
    .valid(...STORES),
  app: joi
    .string()
    .required()
    .valid(...FRAMEWORKS),
  gcp: joi
    .object<GcpConfig>({
      project: joi.string().required().min(4),
      keyfilename: joi.string().optional().min(5)
    })
    .optional()
});

const { NODE_ENV, HOST, PORT, BUS, STORE, GCP_PROJECT, GCP_KEYFILENAME } =
  process.env;

const { error, value } = schema.validate({
  env: NODE_ENV || "development",
  host: HOST || "http://localhost",
  port: Number.parseInt(PORT || "3000"),
  bus: BUS || "in-memory",
  store: STORE || "in-memory",
  app: "express",
  gcp: GCP_PROJECT
    ? {
        project: GCP_PROJECT,
        keyfilename: GCP_KEYFILENAME
      }
    : undefined
});
if (error) throw Error(error.message);

export const config: Config = value;
