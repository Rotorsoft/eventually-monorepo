import { App } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as policies from "./accounts.policies";
import * as systems from "./accounts.systems";

App(new ExpressApp())
  .withCommands(commands.factory)
  .withEvents(events.factory)
  .withPolicy(policies.IntegrateAccount1)
  .withPolicy(policies.IntegrateAccount2)
  .withPolicy(policies.IntegrateAccount3)
  .withPolicy(policies.WaitForAllAndComplete)
  .withExternalSystem(systems.ExternalSystem1)
  .withExternalSystem(systems.ExternalSystem2)
  .withExternalSystem(systems.ExternalSystem3)
  .withExternalSystem(systems.ExternalSystem4)
  .build();

void App().listen();
