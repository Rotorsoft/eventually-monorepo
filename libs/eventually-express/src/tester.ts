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
  State,
  ReducibleFactory,
  reduciblePath,
  Snapshot
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";

type Tester = {
  get: (path: string) => Promise<AxiosResponse<any>>;
  invoke: <
    P extends State,
    S extends State,
    C extends Messages,
    E extends Messages
  >(
    factory: CommandAdapterFactory<P, C>,
    payload: P
  ) => Promise<Snapshot<S, E>[]>;
  command: <S extends State, C extends Messages, E extends Messages>(
    factory: CommandHandlerFactory<S, C, E>,
    command: Command<C>,
    headers?: Record<string, string>
  ) => Promise<Snapshot<S, E>[]>;
  event: <S extends State, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<S, C, E>,
    event: CommittedEvent<E>
  ) => Promise<{
    status: number;
    data: Message<C> | undefined;
  }>;
  load: <S extends State, C extends Messages, E extends Messages>(
    reducible: ReducibleFactory<S, C, E>,
    id: string
  ) => Promise<Snapshot<S, E>>;
  stream: <S extends State, C extends Messages, E extends Messages>(
    reducible: ReducibleFactory<S, C, E>,
    id: string,
    options?: {
      useSnapshots?: boolean;
    }
  ) => Promise<Snapshot<S, E>[]>;
  read: (query?: AllQuery) => Promise<CommittedEvent[]>;
  sleep: (millis: number) => Promise<void>;
};

export const tester = (port = 3000): Tester => {
  const url = (path: string): string => `http://localhost:${port}${path}`;

  return {
    get: (path: string): Promise<AxiosResponse<any>> =>
      axios.get<any>(url(path)),

    async invoke<
      P extends State,
      S extends State,
      C extends Messages,
      E extends Messages
    >(
      factory: CommandAdapterFactory<P, C>,
      payload: P
    ): Promise<Snapshot<S, E>[]> {
      const { data } = await axios.post<P, AxiosResponse<Snapshot<S, E>[]>>(
        url("/".concat(decamelize(factory.name))),
        payload
      );
      return data;
    },

    command: async <S extends State, C extends Messages, E extends Messages>(
      factory: CommandHandlerFactory<S, C, E>,
      command: Command<C>,
      headers: Record<string, string> = {}
    ): Promise<Snapshot<S, E>[]> => {
      command.expectedVersion &&
        (headers["If-Match"] = command.expectedVersion.toString());
      const { data } = await axios.post<State, AxiosResponse<Snapshot<S, E>[]>>(
        url(
          commandHandlerPath(
            factory.name,
            "reduce" in factory(""),
            command.name
          ).replace(":id", command?.id || "")
        ),
        command.data || {},
        { headers }
      );
      return data;
    },

    event: async <S extends State, C extends Messages, E extends Messages>(
      factory: EventHandlerFactory<S, C, E>,
      event: CommittedEvent<E>
    ): Promise<{
      status: number;
      data: Message<C> | undefined;
    }> => {
      const { status, data } = await axios.post<
        State,
        AxiosResponse<Message<C> | undefined>
      >(url(eventHandlerPath(factory.name)), event);
      return { status, data };
    },

    load: async <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string
    ): Promise<Snapshot<S, E>> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<S, E>>>(
        url(reduciblePath(reducible.name).replace(":id", id))
      );
      return data;
    },

    stream: async <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string,
      options: {
        useSnapshots?: boolean;
      } = { useSnapshots: false }
    ): Promise<Snapshot<S, E>[]> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<S, E>[]>>(
        url(
          reduciblePath(reducible.name)
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
