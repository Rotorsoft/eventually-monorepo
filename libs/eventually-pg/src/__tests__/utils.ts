import { bind, Message } from "@andela-technology/eventually";

export type E = {
  test1: { value: string };
  test2: { value: string };
  test3: { value: string };
};

export const event = (name: keyof E, data: E[keyof E]): Message =>
  bind<E>(name, data) as Message;

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
