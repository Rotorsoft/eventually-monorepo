import { bind, Message, STATE_EVENT } from "@rotorsoft/eventually";

export type E = {
  test1: { value: string };
  test2: { value: string };
  test3: { value: string };
  [STATE_EVENT]: { value: string };
};

export const event = (name: keyof E, data: E[keyof E]): Message =>
  bind(name, data) as Message;

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
