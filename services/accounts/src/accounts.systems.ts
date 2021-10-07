import { ExternalSystem } from "@rotorsoft/eventually";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as models from "./accounts.models";
import * as uuid from "uuid";

export const ExternalSystem1 = (): ExternalSystem<
  Pick<commands.Commands, "CreateAccount1">,
  Pick<events.Events, "Account1Created">
> => ({
  stream: () => "ExternalSystem1",
  onCreateAccount1: (data: models.Account) => {
    // here we create the external account 1
    const externalId = uuid.v4();
    return Promise.resolve([
      events.factory.Account1Created({ ...data, externalId })
    ]);
  }
});

export const ExternalSystem2 = (): ExternalSystem<
  Pick<commands.Commands, "CreateAccount2">,
  Pick<events.Events, "Account2Created">
> => ({
  stream: () => "ExternalSystem2",
  onCreateAccount2: (data: models.Account) => {
    // here we create the external account 2
    const externalId = uuid.v4();
    return Promise.resolve([
      events.factory.Account2Created({ ...data, externalId })
    ]);
  }
});

export const ExternalSystem3 = (): ExternalSystem<
  Pick<commands.Commands, "CreateAccount3">,
  Pick<events.Events, "Account3Created">
> => ({
  stream: () => "ExternalSystem3",
  onCreateAccount3: (data: models.Account) => {
    // here we create the external account 3
    const externalId = uuid.v4();
    return Promise.resolve([
      events.factory.Account3Created({ ...data, externalId })
    ]);
  }
});

export const ExternalSystem4 = (): ExternalSystem<
  Pick<commands.Commands, "CompleteIntegration">,
  Pick<events.Events, "IntegrationCompleted">
> => ({
  stream: () => "ExternalSystem4",
  onCompleteIntegration: (data: models.WaitForAllState) => {
    // here we could send and email
    return Promise.resolve([events.factory.IntegrationCompleted(data)]);
  }
});
