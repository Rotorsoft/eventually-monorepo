import { bind, Policy, ProcessManagerFactory } from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./accounts.schemas";

export const IntegrateAccount1 = (): Policy<
  Pick<schemas.Commands, "CreateAccount1">,
  Pick<schemas.Events, "AccountCreated">
> => ({
  description: "Integration Account 1",
  schemas: {
    commands: { CreateAccount1: "when first account is created" },
    events: { AccountCreated: schemas.Account }
  },
  on: {
    AccountCreated: (event) => {
      // we don't have much to do here, just return the command to external system 1
      return Promise.resolve(bind("CreateAccount1", event.data));
    }
  }
});

export const IntegrateAccount2 = (): Policy<
  Pick<schemas.Commands, "CreateAccount2">,
  Pick<schemas.Events, "AccountCreated">
> => ({
  description: "Integration Account 2",
  schemas: {
    commands: { CreateAccount2: "when first account is created" },
    events: { AccountCreated: schemas.Account }
  },
  on: {
    AccountCreated: (event) => {
      // we don't have much to do here, just return the command to external system 2
      return Promise.resolve(bind("CreateAccount2", event.data));
    }
  }
});

export const IntegrateAccount3 = (): Policy<
  Pick<schemas.Commands, "CreateAccount3">,
  Pick<schemas.Events, "Account2Created">
> => ({
  description: "Integration Account 3",
  schemas: {
    commands: { CreateAccount3: "when account2 is created" },
    events: { Account2Created: schemas.ExternalAccount }
  },
  on: {
    Account2Created: (event) => {
      // we don't have much to do here, just return the command to external system 3
      return Promise.resolve(
        bind("CreateAccount3", { id: event?.data?.id || "" })
      );
    }
  }
});

export const WaitForAllAndComplete: ProcessManagerFactory<
  z.infer<typeof schemas.WaitForAllState>,
  Pick<schemas.Commands, "CompleteIntegration">,
  Pick<schemas.Events, "Account1Created" | "Account3Created">
> = (eventOrId) => ({
  description: "Wait for all and complete saga",
  schemas: {
    state: schemas.WaitForAllState,
    commands: { CompleteIntegration: "when account 3 is ready" },
    events: {
      Account1Created: schemas.ExternalAccount,
      Account3Created: schemas.ExternalAccount
    }
  },
  stream: () =>
    typeof eventOrId === "string"
      ? eventOrId
      : `WaitForAllAndComplete:${eventOrId.data.id}`,
  init: () => ({
    id:
      typeof eventOrId === "string"
        ? eventOrId.substring("WaitForAllAndComplete:".length)
        : eventOrId.data.id
  }),

  on: {
    Account1Created: (event, data) => {
      // make sure all accounts are created
      if (data.account3)
        return Promise.resolve(bind("CompleteIntegration", data));
    },
    Account3Created: (event, data) => {
      // make sure all accounts are created
      if (data.account1)
        return Promise.resolve(
          bind("CompleteIntegration", { id: event?.data?.id || "" })
        );
    }
  },

  reduce: {
    Account1Created: (state, event) => ({
      ...state,
      account1: event?.data?.externalId
    }),
    Account3Created: (state, event) => ({
      ...state,
      account3: event?.data?.externalId
    })
  }
});
