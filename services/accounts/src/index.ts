import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import * as policies from "./accounts.policies";
import * as systems from "./accounts.systems";

app(new ExpressApp())
  .with(policies.IntegrateAccount1)
  .with(policies.IntegrateAccount2)
  .with(policies.IntegrateAccount3)
  .with(policies.WaitForAllAndComplete)
  .with(systems.ExternalSystem1)
  .with(systems.ExternalSystem2)
  .with(systems.ExternalSystem3)
  .with(systems.ExternalSystem4)
  .build();

void app().listen();
