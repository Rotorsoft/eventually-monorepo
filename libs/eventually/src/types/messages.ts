/**
 * Messages are defined as types
 */
export type Payload = Record<string, unknown>;
export type Messages = Record<string, Payload>;

/**
 * Messages have
 * - `name` a name
 * - `data` a payload
 */
export type Message<T extends Messages = any> = {
  readonly name: keyof T & string;
  readonly data: Readonly<T[keyof T]>;
};

/**
 * Actors invoke public commands
 * - `name` Actor name
 * - `roles` Actor roles
 */
export type Actor = {
  name: string;
  roles: string[];
};

/**
 * Commands are messages with optional target arguments
 * - `id?` Target aggregate id
 * - `expectedVersion?` Target aggregate expected version
 * - `actor?` Actor invoking this command
 */
export type Command<T extends Messages = any> = Message<T> & {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
};

/**
 * Committed event metadata
 * - `correlation` Id that correlates message flows across time and systems
 * - `causation` The direct cause of the event
 */
export type CommittedEventMetadata = {
  correlation: string;
  causation: {
    command?: Command;
    event?: {
      name: string;
      stream: string;
      id: number;
    };
  };
};

/**
 * Committed events are messages with:
 * - `id` Event index in the "all" stream
 * - `stream` Reducible stream name
 * - `version` Unique sequence number within the stream
 * - `created` Date-Time of creation
 * - `name` Event name
 * - `data?` Otional payload
 * - `metadata?` Optional metadata
 */
export type CommittedEvent<T extends Messages = any> = Message<T> & {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly metadata?: CommittedEventMetadata;
};
