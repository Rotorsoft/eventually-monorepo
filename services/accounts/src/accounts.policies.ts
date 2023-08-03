import { bind, Policy, ProcessManagerFactory } from "@andela-technology/eventually";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as models from "./accounts.models";
import * as schemas from "./accounts.schemas";

export const IntegrateAccount1 = (): Policy<
  Pick<commands.Commands, "CreateAccount1">,
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (event) => {
    // we don't have much to do here, just return the command to external system 1
    return Promise.resolve(bind("CreateAccount1", event.data));
  }
});

export const IntegrateAccount2 = (): Policy<
  Pick<commands.Commands, "CreateAccount2">,
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (event) => {
    // we don't have much to do here, just return the command to external system 2
    return Promise.resolve(bind("CreateAccount2", event.data));
  }
});

export const IntegrateAccount3 = (): Policy<
  Pick<commands.Commands, "CreateAccount3">,
  Pick<events.Events, "Account2Created">
> => ({
  onAccount2Created: (event) => {
    // we don't have much to do here, just return the command to external system 3
    return Promise.resolve(
      bind("CreateAccount3", { id: event?.data?.id || "" })
    );
  }
});

export const WaitForAllAndComplete: ProcessManagerFactory<
  models.WaitForAllState,
  Pick<commands.Commands, "CompleteIntegration">,
  Pick<events.Events, "Account1Created" | "Account3Created">
> = (eventOrId) => ({
  stream: () =>
    typeof eventOrId === "string"
      ? eventOrId
      : `WaitForAllAndComplete:${
          (eventOrId.data as models.ExternalAccount).id
        }`,

  schema: () => schemas.WaitForAllState,
  init: () => ({
    id:
      typeof eventOrId === "string"
        ? eventOrId.substring("WaitForAllAndComplete:".length)
        : (eventOrId.data as models.ExternalAccount).id
  }),

  onAccount1Created: (event, data) => {
    // make sure all accounts are created
    if (data.account3)
      return Promise.resolve(bind("CompleteIntegration", data));
  },

  onAccount3Created: (event, data) => {
    // make sure all accounts are created
    if (data.account1)
      return Promise.resolve(
        bind("CompleteIntegration", { id: event?.data?.id || "" })
      );
  },

  applyAccount1Created: (state, event) => ({
    ...state,
    account1: event?.data?.externalId
  }),

  applyAccount3Created: (state, event) => ({
    ...state,
    account3: event?.data?.externalId
  })
});
