import { MessageFactory } from "@rotorsoft/eventually";
import * as models from "./accounts.models";
import * as schemas from "./accounts.schemas";

export type Commands = {
  CreateAccount1: models.Account;
  CreateAccount2: models.Account;
  CreateAccount3: models.Account;
  CompleteIntegration: models.Account;
};

export const factory: MessageFactory<Commands> = {
  CreateAccount1: (data: models.Account) => ({
    name: "CreateAccount1",
    data,
    schema: () => schemas.CreateAccount1
  }),

  CreateAccount2: (data: models.Account) => ({
    name: "CreateAccount2",
    data,
    schema: () => schemas.CreateAccount2
  }),

  CreateAccount3: (data: models.Account) => ({
    name: "CreateAccount3",
    data,
    schema: () => schemas.CreateAccount3
  }),

  CompleteIntegration: (data: models.WaitForAllState) => ({
    name: "CompleteIntegration",
    data,
    schema: () => schemas.CompleteIntegration
  })
};
