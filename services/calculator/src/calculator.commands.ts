import { Keys } from "./calculator.models";

export type Commands = {
  PressKey: { key: Keys };
  Reset: undefined;
  Whatever: undefined;
};
