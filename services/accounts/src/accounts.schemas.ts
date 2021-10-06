import * as joi from "joi";
import * as models from "./accounts.models";

export const Account = joi.object<models.Account>({
  id: joi.string().required().min(3).max(20)
});

export const ExternalAccount = joi.object<models.ExternalAccount>({
  id: joi.string().required().min(3).max(20),
  externalId: joi.string().required().guid()
});

export const WaitForAllState = joi
  .object<models.WaitForAllState>({
    account1: joi.string().optional().uuid(),
    account3: joi.string().optional().uuid()
  })
  .concat(Account)
  .required();

export const AccountCreated = joi.object({
  name: joi.string().required().valid("AccountCreated"),
  data: Account.required()
});

export const Account1Created = joi.object({
  name: joi.string().required().valid("Account1Created"),
  data: ExternalAccount.required()
});

export const Account2Created = joi.object({
  name: joi.string().required().valid("Account2Created"),
  data: ExternalAccount.required()
});

export const Account3Created = joi.object({
  name: joi.string().required().valid("Account3Created"),
  data: ExternalAccount.required()
});

export const IntegrationCompleted = joi.object({
  name: joi.string().required().valid("IntegrationCompleted"),
  data: WaitForAllState.required()
});

export const CreateAccount1 = joi.object({
  name: joi.string().required().valid("CreateAccount1"),
  data: Account.required()
});

export const CreateAccount2 = joi.object({
  name: joi.string().required().valid("CreateAccount2"),
  data: Account.required()
});

export const CreateAccount3 = joi.object({
  name: joi.string().required().valid("CreateAccount3"),
  data: Account.required()
});

export const CompleteIntegration = joi.object({
  name: joi.string().required().valid("CompleteIntegration"),
  data: WaitForAllState.required()
});
