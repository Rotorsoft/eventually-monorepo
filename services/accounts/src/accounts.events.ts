import { MessageFactory } from "@rotorsoft/eventually";
import * as models from "./accounts.models";
import * as schemas from "./accounts.schemas";

export type Events = {
  AccountCreated: models.Account;
  Account1Created: models.ExternalAccount;
  Account2Created: models.ExternalAccount;
  Account3Created: models.ExternalAccount;
  IntegrationCompleted: models.Account;
};

export const factory: MessageFactory<Events> = {
  AccountCreated: (data: models.Account) => ({
    name: "AccountCreated",
    data,
    schema: () => schemas.AccountCreated
  }),

  Account1Created: (data: models.ExternalAccount) => ({
    name: "Account1Created",
    data,
    schema: () => schemas.Account1Created
  }),

  Account2Created: (data: models.ExternalAccount) => ({
    name: "Account2Created",
    data,
    schema: () => schemas.Account2Created
  }),

  Account3Created: (data: models.ExternalAccount) => ({
    name: "Account3Created",
    data,
    schema: () => schemas.Account3Created
  }),

  IntegrationCompleted: (data: models.WaitForAllState) => ({
    name: "IntegrationCompleted",
    data,
    schema: () => schemas.IntegrationCompleted
  })
};
