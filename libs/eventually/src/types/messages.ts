/**
 * Message payloads are objects
 */
export type Payload = Record<string, unknown>;

/**
 * Messages have
 * - `name` Bound message name
 * - `data?` Optional payload
 */
export type Message<Name extends string, Type extends Payload> = {
  readonly name: Name;
  readonly data?: Type;
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
export type Command<Name extends string, Type extends Payload> = Message<
  Name,
  Type
> & {
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
    command?: Command<string, Payload>;
    event?: {
      name: string;
      stream: string;
      id: number;
    };
  };
};

/**
 * Committed events have:
 * - `id` Event index in the "all" stream
 * - `stream` Reducible stream name
 * - `version` Unique sequence number within the stream
 * - `created` Date-Time of creation
 * - `name` Event name
 * - `data?` Otional payload
 * - `metadata?` Optional metadata
 */
export type CommittedEvent<Name extends string, Type extends Payload> = {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly name: Name;
  readonly data?: Type;
  readonly metadata?: CommittedEventMetadata;
};
