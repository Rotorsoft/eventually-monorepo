import { Broker, Evt, Payload } from "..";

export const InMemoryBroker = (): Broker => {
  return {
    subscribe: (): Promise<void> => {
      return Promise.resolve();
    },

    publish: (event: Evt): Promise<string> => {
      return Promise.resolve(event.id.toString());
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
