import {
  AllQuery,
  Command,
  CommandHandlerFactory,
  commandHandlerPath,
  CommittedEvent,
  EventHandlerFactory,
  eventHandlerPath,
  Message,
  Payload,
  ReducibleFactory,
  reduciblePath,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

type Tester = {
  get: (path: string) => Promise<AxiosResponse<any>>;
  command: <M extends Payload, C, E>(
    handler: CommandHandlerFactory<M, C, E>,
    command: Command<keyof C & string, Payload>,
    headers?: Record<string, string>
  ) => Promise<Snapshot<M>[]>;
  event: <M extends Payload, C, E>(
    handler: EventHandlerFactory<M, C, E>,
    event: Message<keyof E & string, Payload>
  ) => Promise<Message<keyof C & string, Payload> | undefined>;
  load: <M extends Payload, C, E>(
    reducible: ReducibleFactory<M, C, E>,
    id: string
  ) => Promise<Snapshot<M>>;
  stream: <M extends Payload, C, E>(
    reducible: ReducibleFactory<M, C, E>,
    id: string,
    options?: {
      useSnapshots?: boolean;
    }
  ) => Promise<Snapshot<M>[]>;
  read: (query?: AllQuery) => Promise<CommittedEvent<string, Payload>[]>;
  sleep: (millis: number) => Promise<void>;
};

export const tester = (port = 3000): Tester => {
  const url = (path: string): string =>
    `http://localhost:${port || 3000}${path}`;

  return {
    get: (path: string): Promise<AxiosResponse<any>> =>
      axios.get<any>(url(path)),

    command: async <M extends Payload, C, E>(
      handler: CommandHandlerFactory<M, C, E>,
      command: Command<keyof C & string, Payload>,
      headers: Record<string, string> = {}
    ): Promise<Snapshot<M>[]> => {
      command.expectedVersion &&
        (headers["If-Match"] = command.expectedVersion.toString());
      const { data } = await axios.post<Payload, AxiosResponse<Snapshot<M>[]>>(
        url(
          commandHandlerPath(handler, command.name).replace(":id", command.id)
        ),
        command.data || {},
        { headers }
      );
      return data;
    },

    event: async <M extends Payload, C, E>(
      handler: EventHandlerFactory<M, C, E>,
      event: Message<keyof E & string, Payload>
    ): Promise<Message<keyof C & string, Payload> | undefined> => {
      const { data } = await axios.post<
        Payload,
        AxiosResponse<Message<keyof C & string, Payload> | undefined>
      >(url(eventHandlerPath(handler)), event);
      return data;
    },

    load: async <M extends Payload, C, E>(
      reducible: ReducibleFactory<M, C, E>,
      id: string
    ): Promise<Snapshot<M>> => {
      try {
        const response = await axios.get<any, AxiosResponse<Snapshot<M>>>(
          url(reduciblePath(reducible).replace(":id", id))
        );
        if (response.status === 200) return response.data;
        console.log(response);
        throw Error(response.statusText);
      } catch (error) {
        console.log(error);
        throw error;
      }
    },

    stream: async <M extends Payload, C, E>(
      reducible: ReducibleFactory<M, C, E>,
      id: string,
      options: {
        useSnapshots?: boolean;
      } = { useSnapshots: false }
    ): Promise<Snapshot<M>[]> => {
      try {
        const response = await axios.get<any, AxiosResponse<Snapshot<M>[]>>(
          url(
            reduciblePath(reducible)
              .replace(":id", id)
              .concat(
                `/stream${options.useSnapshots ? "?useSnapshots=true" : ""}`
              )
          )
        );
        if (response.status === 200) return response.data;
        console.log(response);
        throw Error(response.statusText);
      } catch (error) {
        console.log(error);
        throw error;
      }
    },

    read: async (
      query: AllQuery = { after: -1, limit: 1 }
    ): Promise<CommittedEvent<string, Payload>[]> => {
      try {
        const response = await axios.get<
          any,
          AxiosResponse<CommittedEvent<string, Payload>[]>
        >(url("/all"), {
          params: query
        });
        if (response.status === 200) return response.data;
        console.log(response);
        throw Error(response.statusText);
      } catch (error) {
        console.log(error);
        throw error;
      }
    },

    sleep: (millis: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, millis))
  };
};
