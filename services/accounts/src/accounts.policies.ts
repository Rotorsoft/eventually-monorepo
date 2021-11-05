import {
  CommittedEvent,
  EvtOf,
  Policy,
  ProcessManager
} from "@rotorsoft/eventually";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as models from "./accounts.models";
import * as schemas from "./accounts.schemas";

export const IntegrateAccount1 = (): Policy<
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (
    event: CommittedEvent<"AccountCreated", models.Account>
  ) => {
    // we don't have much to do here, just return the command to external system 1
    return Promise.resolve({
      command: commands.factory.CreateAccount1,
      data: event.data
    });
  }
});

export const IntegrateAccount2 = (): Policy<
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (
    event: CommittedEvent<"AccountCreated", models.Account>
  ) => {
    // we don't have much to do here, just return the command to external system 2
    return Promise.resolve({
      command: commands.factory.CreateAccount2,
      data: event.data
    });
  }
});

export const IntegrateAccount3 = (): Policy<
  Pick<events.Events, "Account2Created">
> => ({
  onAccount2Created: (
    event: CommittedEvent<"Account2Created", models.ExternalAccount>
  ) => {
    // we don't have much to do here, just return the command to external system 3
    return Promise.resolve({
      command: commands.factory.CreateAccount3,
      data: { id: event.data.id }
    });
  }
});

export const WaitForAllAndComplete = (
  event: EvtOf<Pick<events.Events, "Account1Created" | "Account3Created">>
): ProcessManager<
  models.WaitForAllState,
  Pick<events.Events, "Account1Created" | "Account3Created">
> => ({
  stream: () =>
    `WaitForAllAndComplete:${(event.data as models.ExternalAccount).id}`,

  schema: () => schemas.WaitForAllState,
  init: () => ({ id: (event.data as models.ExternalAccount).id }),

  onAccount1Created: (
    event: CommittedEvent<"Account1Created", models.ExternalAccount>,
    data: models.WaitForAllState
  ) => {
    // make sure all accounts are created
    if (data.account3)
      return Promise.resolve({
        command: commands.factory.CompleteIntegration,
        data
      });
  },

  onAccount3Created: (
    event: CommittedEvent<"Account3Created", models.ExternalAccount>,
    data: models.WaitForAllState
  ) => {
    // make sure all accounts are created
    if (data.account1)
      return Promise.resolve({
        command: commands.factory.CompleteIntegration,
        data: { id: event.data.id }
      });
  },

  applyAccount1Created: (state, event) => ({
    ...state,
    account1: event.data.externalId
  }),

  applyAccount3Created: (state, event) => ({
    ...state,
    account3: event.data.externalId
  })
});
