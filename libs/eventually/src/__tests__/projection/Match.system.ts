import { System } from "../../types";
import * as schemas from "./schemas";
import * as events from "./events";
import { z } from "zod";
import { bind } from "../../utils";

export type MatchCommands = {
  CreateCustomer: z.infer<typeof schemas.CustomerCreated>;
  ChangeCustomerName: z.infer<typeof schemas.CustomerNameChanged>;
};

export const MatchSystem = (): System<
  MatchCommands,
  events.CustomerEvents
> => ({
  description: "Match projector",
  stream: "MatchSystem",
  schemas: {
    commands: {
      CreateCustomer: schemas.CustomerCreated,
      ChangeCustomerName: schemas.CustomerNameChanged
    },
    events: {
      CustomerCreated: schemas.CustomerCreated,
      CustomerNameChanged: schemas.CustomerNameChanged
    }
  },
  on: {
    CreateCustomer: (data) => Promise.resolve([bind("CustomerCreated", data)]),
    ChangeCustomerName: (data) =>
      Promise.resolve([bind("CustomerNameChanged", data)])
  }
});
