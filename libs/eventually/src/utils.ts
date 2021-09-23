import {
  AggregateFactory,
  CommittedEvent,
  Message,
  MessageFactory,
  ModelReducer,
  Payload,
  Policy
} from "./types";

/**
 * Decamelizes string
 * @param value camel-case string
 * @returns decamelized string
 */
export const decamelize = (value: string): string =>
  value
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, "$1-$2")
    .replace(
      /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      "$1-$2"
    )
    .toLowerCase();

/**
 * Extracts message handlers from message factory
 * @param factory message factory
 * @returns array of message handlers
 */
export const handlersOf = <Messages>(
  factory: MessageFactory<Messages>
  // eslint-disable-next-line
): Function[] => {
  // eslint-disable-next-line
  return Object.values<Function>(factory).filter((f: Function) => {
    const message = f();
    return message.name && message.schema;
  });
};

/**
 * Normalizes aggregate path
 * @param factory aggregate factory
 * @returns object with aggregate name and path
 */
export const aggregatePath = <Model extends Payload, Events>(
  factory: (id: string) => ModelReducer<Model, Events>
): { name: string; path: string } => {
  const name = factory("").name();
  const path = "/".concat(decamelize(name), "/:id");
  return { name, path };
};

/**
 * Normalizes aggregate id
 * @param aggregate
 * @returns normalized aggregate id
 */
export const aggregateId = <Model extends Payload, Events>(
  aggregate: ModelReducer<Model, Events>
): string => `${aggregate.name()}:${aggregate.id}`;

/**
 * Applies event to model
 * @param reducer model reducer
 * @param event event to apply
 * @param state current model state
 * @returns new model state
 */
export const apply = <Model extends Payload, Events>(
  reducer: ModelReducer<Model, Events>,
  event: CommittedEvent<string, Payload>,
  state: Model
): Model => (reducer as any)["apply".concat(event.name)](state, event);

/**
 * Normalizes command paths
 * @param factory aggregate factory
 * @param command command
 * @returns normalized path
 */
export const commandPath = <Model extends Payload, Commands, Events>(
  factory: AggregateFactory<Model, Commands, Events>,
  command: Message<string, Payload>
): string =>
  "/".concat(decamelize(factory("").name()), "/:id/", decamelize(command.name));

/**
 * Normalizes event paths
 * @param policy policy
 * @param event event
 * @returns normalized path
 */
export const eventPath = <Commands, Events>(
  policy: Policy<Commands, Events>,
  event: CommittedEvent<string, Payload>
): string => "/".concat(decamelize(policy.name()), "/", decamelize(event.name));
