import * as joi from "joi";
import * as models from "./accounts.models";

export const Account = joi.object<models.Account>({
  id: joi.string().required().uuid()
});

export const ExternalAccount = joi.object<models.ExternalAccount>({
  id: joi.string().required().uuid(),
  externalId: joi.string().required().uuid()
});

export const WaitForAllState = joi
  .object<models.WaitForAllState>({
    account1: joi.string().optional().uuid(),
    account3: joi.string().optional().uuid()
  })
  .concat(Account)
  .required();

export const AccountCreated = Account.required();
export const Account1Created = ExternalAccount.required();
export const Account2Created = ExternalAccount.required();
export const Account3Created = ExternalAccount.required();
export const IntegrationCompleted = WaitForAllState.required();
export const CreateAccount1 = Account.required();
export const CreateAccount2 = Account.required();
export const CreateAccount3 = Account.required();
export const CompleteIntegration = WaitForAllState.required();
