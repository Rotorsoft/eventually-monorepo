import { CommittedEvent, EvtOf, Policy } from "@rotorsoft/eventually";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as models from "./accounts.models";

export const IntegrateAccount1 = (): Policy<
  Pick<commands.Commands, "CreateAccount1">,
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (
    event: CommittedEvent<"AccountCreated", models.Account>
  ) => {
    // we don't have much to do here, just return the command to external system 1
    return Promise.resolve({
      command: commands.factory.CreateAccount1(event.data)
    });
  }
});

export const IntegrateAccount2 = (): Policy<
  Pick<commands.Commands, "CreateAccount2">,
  Pick<events.Events, "AccountCreated">
> => ({
  onAccountCreated: (
    event: CommittedEvent<"AccountCreated", models.Account>
  ) => {
    // we don't have much to do here, just return the command to external system 2
    return Promise.resolve({
      command: commands.factory.CreateAccount2(event.data)
    });
  }
});

export const IntegrateAccount3 = (): Policy<
  Pick<commands.Commands, "CreateAccount3">,
  Pick<events.Events, "Account2Created">
> => ({
  onAccount2Created: (
    event: CommittedEvent<"Account2Created", models.ExternalAccount>
  ) => {
    // we don't have much to do here, just return the command to external system 3
    return Promise.resolve({
      command: commands.factory.CreateAccount3({ id: event.data.id })
    });
  }
});

export const WaitForAllAndComplete = (
  event: EvtOf<Pick<events.Events, "Account1Created" | "Account3Created">>
): Policy<
  Pick<commands.Commands, "CompleteIntegration">,
  Pick<events.Events, "Account1Created" | "Account3Created">,
  models.WaitForAllState
> => ({
  onAccount1Created: (
    event: CommittedEvent<"Account1Created", models.ExternalAccount>,
    data: models.WaitForAllState
  ) => {
    // make sure all accounts are created
    if (data.account3)
      return Promise.resolve({
        command: commands.factory.CompleteIntegration(data)
      });
  },

  onAccount3Created: (
    event: CommittedEvent<"Account3Created", models.ExternalAccount>,
    data: models.WaitForAllState
  ) => {
    // make sure all accounts are created
    if (data.account1)
      return Promise.resolve({
        command: commands.factory.CompleteIntegration({ id: event.data.id })
      });
  },

  reducer: {
    stream: () =>
      `WaitForAllAndComplete:${(event.data as models.ExternalAccount).id}`,
    init: () => ({ id: (event.data as models.ExternalAccount).id }),
    applyAccount1Created: (state, event) => ({
      ...state,
      account1: event.data.externalId
    }),
    applyAccount3Created: (state, event) => ({
      ...state,
      account3: event.data.externalId
    })
  }
});
