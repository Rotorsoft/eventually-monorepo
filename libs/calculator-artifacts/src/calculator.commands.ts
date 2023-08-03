import { Payload } from "@andela-technology/eventually";
import { z } from "zod";
//import { Keys } from "./calculator.models";
import { PressKey } from "./calculator.schemas";

export type Commands = {
  PressKey: z.infer<typeof PressKey>; // { readonly key: Keys };
  Reset: Payload;
  Whatever: Payload;
  Forget: Payload;
};
