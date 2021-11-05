import { MessageFactories, Scopes } from "@rotorsoft/eventually";
import * as models from "./accounts.models";
import * as schemas from "./accounts.schemas";

export type Commands = {
  CreateAccount1: models.Account;
  CreateAccount2: models.Account;
  CreateAccount3: models.Account;
  CompleteIntegration: models.Account;
};

export const factory: MessageFactories<Commands> = {
  CreateAccount1: () => ({
    scope: Scopes.public,
    schema: schemas.CreateAccount1
  }),

  CreateAccount2: () => ({
    schema: schemas.CreateAccount2
  }),

  CreateAccount3: () => ({
    schema: schemas.CreateAccount3
  }),

  CompleteIntegration: () => ({
    schema: schemas.CompleteIntegration
  })
};
