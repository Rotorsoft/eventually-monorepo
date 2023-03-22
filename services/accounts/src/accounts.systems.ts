import { bind, System } from "@rotorsoft/eventually";
import * as schemas from "./accounts.schemas";
import * as uuid from "uuid";

export const ExternalSystem1 = (): System<
  Pick<schemas.Commands, "CreateAccount1">,
  Pick<schemas.Events, "Account1Created">
> => ({
  description: "External System 1",
  schemas: {
    commands: { CreateAccount1: schemas.Account },
    events: { Account1Created: schemas.ExternalAccount }
  },
  stream: "ExternalSystem1",
  on: {
    CreateAccount1: (data) => {
      // here we create the external account 1
      const externalId = uuid.v4();
      return Promise.resolve([
        bind("Account1Created", { ...data, externalId })
      ]);
    }
  }
});

export const ExternalSystem2 = (): System<
  Pick<schemas.Commands, "CreateAccount2">,
  Pick<schemas.Events, "Account2Created">
> => ({
  description: "External System 2",
  schemas: {
    commands: { CreateAccount2: schemas.Account },
    events: { Account2Created: schemas.ExternalAccount }
  },
  stream: "ExternalSystem2",
  on: {
    CreateAccount2: (data) => {
      // here we create the external account 2
      const externalId = uuid.v4();
      return Promise.resolve([
        bind("Account2Created", { ...data, externalId })
      ]);
    }
  }
});

export const ExternalSystem3 = (): System<
  Pick<schemas.Commands, "CreateAccount3">,
  Pick<schemas.Events, "Account3Created">
> => ({
  description: "External System 3",
  schemas: {
    commands: { CreateAccount3: schemas.Account },
    events: { Account3Created: schemas.ExternalAccount }
  },
  stream: "ExternalSystem3",
  on: {
    CreateAccount3: (data) => {
      // here we create the external account 3
      const externalId = uuid.v4();
      return Promise.resolve([
        bind("Account3Created", { ...data, externalId })
      ]);
    }
  }
});

export const ExternalSystem4 = (): System<
  Pick<schemas.Commands, "CompleteIntegration">,
  Pick<schemas.Events, "IntegrationCompleted">
> => ({
  description: "External System 4",
  schemas: {
    commands: { CompleteIntegration: schemas.WaitForAllState },
    events: { IntegrationCompleted: schemas.Account }
  },
  stream: "ExternalSystem4",
  on: {
    CompleteIntegration: (data) => {
      if (data.id === "crash-it") throw Error("error completing integration");
      // here we could send and email
      return Promise.resolve([bind("IntegrationCompleted", data)]);
    }
  }
});
