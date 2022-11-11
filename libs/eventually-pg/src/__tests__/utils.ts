import { bind, Message, Payload } from "@rotorsoft/eventually";

export type E = {
  test1: { value: string };
  test2: { value: string };
  test3: { value: string };
};

export const event = (
  name: keyof E,
  data?: Payload
): Message<keyof E & string, Payload> => bind(name, data);

export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
