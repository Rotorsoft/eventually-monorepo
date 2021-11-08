import { MessageFactory, Scopes } from "@rotorsoft/eventually";
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
  AccountCreated: () => ({
    scope: Scopes.public,
    schema: schemas.AccountCreated
  }),

  Account1Created: () => ({
    schema: schemas.Account1Created
  }),

  Account2Created: () => ({
    schema: schemas.Account2Created
  }),

  Account3Created: () => ({
    schema: schemas.Account3Created
  }),

  IntegrationCompleted: () => ({
    scope: Scopes.public,
    schema: schemas.IntegrationCompleted
  })
};
