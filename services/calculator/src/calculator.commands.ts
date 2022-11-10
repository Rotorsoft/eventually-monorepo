import { Keys } from "./calculator.models";

export type Commands = {
  PressKey: { readonly key: Keys };
  Reset: undefined;
  Whatever: undefined;
  Forget: undefined;
};
