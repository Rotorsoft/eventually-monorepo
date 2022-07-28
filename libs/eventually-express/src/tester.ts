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
  ProjectorFactory,
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
  ) => Promise<{
    status: number;
    data: Message<keyof C & string, Payload> | undefined;
  }>;
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
  query: (query?: AllQuery) => Promise<CommittedEvent<string, Payload>[]>;
  read: <M extends Payload, E>(
    projector: ProjectorFactory<M, E>
  ) => Promise<Array<Readonly<M>>>;
  sleep: (millis: number) => Promise<void>;
};

export const tester = (port = 3000): Tester => {
  const url = (path: string): string => `http://localhost:${port}${path}`;

  return {
    get: (path: string): Promise<AxiosResponse<any>> =>
      axios.get<any>(url(path)),

    command: async <M extends Payload, C, E>(
      handler: CommandHandlerFactory<M, C, E>,
      command: Command<keyof C & string, Payload>,
      headers: Record<string, string> = {}
    ): Promise<Snapshot<M>[]> => {
      const _url = url(
        commandHandlerPath(handler, command.name).replace(":id", command.id)
      );
      try {
        command.expectedVersion &&
          (headers["If-Match"] = command.expectedVersion.toString());
        const { data } = await axios.post<
          Payload,
          AxiosResponse<Snapshot<M>[]>
        >(_url, command.data || {}, { headers });
        return data;
      } catch (error) {
        console.log(
          `AXIOS POST ${_url} ${error.response.status}`,
          error.response.data
        );
        throw error;
      }
    },

    event: async <M extends Payload, C, E>(
      handler: EventHandlerFactory<M, C, E>,
      event: Message<keyof E & string, Payload>
    ): Promise<{
      status: number;
      data: Message<keyof C & string, Payload> | undefined;
    }> => {
      const _url = url(eventHandlerPath(handler));
      try {
        const { status, data } = await axios.post<
          Payload,
          AxiosResponse<Message<keyof C & string, Payload> | undefined>
        >(_url, event);
        return { status, data };
      } catch (error) {
        console.log(
          `AXIOS POST ${_url} ${error.response.status}`,
          error.response.data
        );
        throw error;
      }
    },

    load: async <M extends Payload, C, E>(
      reducible: ReducibleFactory<M, C, E>,
      id: string
    ): Promise<Snapshot<M>> => {
      const _url = url(reduciblePath(reducible).replace(":id", id));
      try {
        const { data } = await axios.get<any, AxiosResponse<Snapshot<M>>>(_url);
        return data;
      } catch (error) {
        console.log(
          `AXIOS GET ${_url} ${error.response.status}`,
          error.response.data
        );
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
      const _url = url(
        reduciblePath(reducible)
          .replace(":id", id)
          .concat(`/stream${options.useSnapshots ? "?useSnapshots=true" : ""}`)
      );
      try {
        const { data } = await axios.get<any, AxiosResponse<Snapshot<M>[]>>(
          _url
        );
        return data;
      } catch (error) {
        console.log(
          `AXIOS GET ${_url} ${error.response.status}`,
          error.response.data
        );
        throw error;
      }
    },

    query: async (
      query: AllQuery = { after: -1, limit: 1 }
    ): Promise<CommittedEvent<string, Payload>[]> => {
      const _url = url("/all");
      try {
        const { data } = await axios.get<
          any,
          AxiosResponse<CommittedEvent<string, Payload>[]>
        >(_url, {
          params: query
        });
        return data;
      } catch (error) {
        console.log(
          `AXIOS GET ${_url} ${error.response.status}`,
          error.response.data
        );
        throw error;
      }
    },

    read: async <M extends Payload, E>(
      projector: ProjectorFactory<M, E>
    ): Promise<Array<Readonly<M>>> => {
      const _url = url(
        eventHandlerPath(projector as EventHandlerFactory<M, unknown, unknown>)
      );
      try {
        const { data } = await axios.get<
          any,
          AxiosResponse<Array<Readonly<M>>>
        >(_url);
        return data;
      } catch (error) {
        console.log(
          `AXIOS GET ${_url} ${error.response.status}`,
          error.response.data
        );
        throw error;
      }
    },

    sleep: (millis: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, millis))
  };
};
