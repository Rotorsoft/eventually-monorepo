import { MessageFactory, Scopes } from "@rotorsoft/eventually";
import * as schemas from "./calculator.schemas";
import { Digits, Operators } from "./calculator.models";

export type Events = {
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
};

export const events: MessageFactory<Events> = {
  DigitPressed: () => ({
    scope: Scopes.public,
    schema: schemas.DigitPressed
  }),

  DotPressed: () => ({
    scope: Scopes.public
  }),

  EqualsPressed: () => ({
    scope: Scopes.public
  }),

  OperatorPressed: () => ({
    schema: schemas.OperatorPressed
  }),

  Cleared: () => ({
    scope: Scopes.public
  })
};
