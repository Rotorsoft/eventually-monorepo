import { Broker, EvtOf, Payload } from "..";

export const InMemoryBroker = (): Broker => {
  return {
    subscribe: (): Promise<void> => {
      return Promise.resolve();
    },

    publish: (event: EvtOf<unknown>): Promise<string> => {
      return Promise.resolve(event.id.toString());
    },

    decode: (msg: Payload): EvtOf<unknown> => msg as EvtOf<unknown>
  };
};
