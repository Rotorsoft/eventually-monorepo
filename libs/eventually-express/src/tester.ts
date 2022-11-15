import {
  AllQuery,
  Command,
  CommandAdapterFactory,
  CommandHandlerFactory,
  commandHandlerPath,
  CommittedEvent,
  decamelize,
  EventHandlerFactory,
  eventHandlerPath,
  Message,
  Messages,
  Payload,
  ReducibleFactory,
  reduciblePath,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

type Tester = {
  get: (path: string) => Promise<AxiosResponse<any>>;
  invoke: <
    P extends Payload,
    M extends Payload,
    C extends Messages,
    E extends Messages
  >(
    factory: CommandAdapterFactory<P, C>,
    payload: P
  ) => Promise<Snapshot<M, E>[]>;
  command: <M extends Payload, C extends Messages, E extends Messages>(
    factory: CommandHandlerFactory<M, C, E>,
    command: Command<C>,
    headers?: Record<string, string>
  ) => Promise<Snapshot<M, E>[]>;
  event: <M extends Payload, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<M, C, E>,
    event: CommittedEvent<E>
  ) => Promise<{
    status: number;
    data: Message<C> | undefined;
  }>;
  load: <M extends Payload, C extends Messages, E extends Messages>(
    reducible: ReducibleFactory<M, C, E>,
    id: string
  ) => Promise<Snapshot<M, E>>;
  stream: <M extends Payload, C extends Messages, E extends Messages>(
    reducible: ReducibleFactory<M, C, E>,
    id: string,
    options?: {
      useSnapshots?: boolean;
    }
  ) => Promise<Snapshot<M, E>[]>;
  read: (query?: AllQuery) => Promise<CommittedEvent[]>;
  sleep: (millis: number) => Promise<void>;
};

export const tester = (port = 3000): Tester => {
  const url = (path: string): string => `http://localhost:${port}${path}`;

  return {
    get: (path: string): Promise<AxiosResponse<any>> =>
      axios.get<any>(url(path)),

    async invoke<
      P extends Payload,
      M extends Payload,
      C extends Messages,
      E extends Messages
    >(
      factory: CommandAdapterFactory<P, C>,
      payload: P
    ): Promise<Snapshot<M, E>[]> {
      const { data } = await axios.post<P, AxiosResponse<Snapshot<M, E>[]>>(
        url("/".concat(decamelize(factory.name))),
        payload
      );
      return data;
    },

    command: async <M extends Payload, C extends Messages, E extends Messages>(
      factory: CommandHandlerFactory<M, C, E>,
      command: Command<C>,
      headers: Record<string, string> = {}
    ): Promise<Snapshot<M, E>[]> => {
      command.expectedVersion &&
        (headers["If-Match"] = command.expectedVersion.toString());
      const { data } = await axios.post<
        Payload,
        AxiosResponse<Snapshot<M, E>[]>
      >(
        url(
          commandHandlerPath(factory, command.name).replace(
            ":id",
            command?.id || ""
          )
        ),
        command.data || {},
        { headers }
      );
      return data;
    },

    event: async <M extends Payload, C extends Messages, E extends Messages>(
      factory: EventHandlerFactory<M, C, E>,
      event: CommittedEvent<E>
    ): Promise<{
      status: number;
      data: Message<C> | undefined;
    }> => {
      const { status, data } = await axios.post<
        Payload,
        AxiosResponse<Message<C> | undefined>
      >(url(eventHandlerPath(factory)), event);
      return { status, data };
    },

    load: async <M extends Payload, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<M, C, E>,
      id: string
    ): Promise<Snapshot<M, E>> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<M, E>>>(
        url(reduciblePath(reducible).replace(":id", id))
      );
      return data;
    },

    stream: async <M extends Payload, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<M, C, E>,
      id: string,
      options: {
        useSnapshots?: boolean;
      } = { useSnapshots: false }
    ): Promise<Snapshot<M, E>[]> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<M, E>[]>>(
        url(
          reduciblePath(reducible)
            .replace(":id", id)
            .concat(
              `/stream${options.useSnapshots ? "?useSnapshots=true" : ""}`
            )
        )
      );
      return data;
    },

    read: async (
      query: AllQuery = { after: -1, limit: 1 }
    ): Promise<CommittedEvent[]> => {
      const { data } = await axios.get<any, AxiosResponse<CommittedEvent[]>>(
        url("/all"),
        {
          params: query
        }
      );
      return data;
    },

    sleep: (millis: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, millis))
  };
};
