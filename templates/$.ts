import { Aggregate, CommittedEvent } from "@rotorsoft/eventually";
import { $Model, ... } from "./$.Model";
import { $Commands } from "./$.Commands";
import { $Events, $EventsFactory } from "./$.Events";

/*
... Encapsulate business logic here!
*/

export const $ = (
  id: string
): Aggregate<$Model, $Commands, $Events> => ({
  id,

  name: () => "$",

  // Model Reducer with event side effects
  init: (): $Model => ({
    result: 0,
  }),

  applyEVENT: (
    model: $Model,
    event: CommittedEvent<"EVENT", EVENTTYPE>
  ) => {
    /*
    ... Reducer logic here!
    */
    return { ...model };
  },

  // Command Handlers validate business rules and poduce events
  onCOMMAND: async (model, data) => {
    /*
    ... Handler logic here!
    */
    return $EventsFactory.EVENT(data);
  },
});
