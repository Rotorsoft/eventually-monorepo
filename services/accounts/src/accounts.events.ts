import * as models from "./accounts.models";

export type Events = {
  AccountCreated: models.Account;
  Account1Created: models.ExternalAccount;
  Account2Created: models.ExternalAccount;
  Account3Created: models.ExternalAccount;
  IntegrationCompleted: models.Account;
};
