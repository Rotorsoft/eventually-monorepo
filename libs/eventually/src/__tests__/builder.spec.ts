import {
  AggregateFactory,
  app,
  config,
  dispose,
  Empty,
  PolicyFactory,
  State,
  ZodEmpty
} from "@rotorsoft/eventually";

type Commands = {
  Command1: Empty;
  Command2: Empty;
};
type Events = {
  Event1: Empty;
  Event2: Empty;
};
const Factory: AggregateFactory<State, Commands, Events> = (
  stream: string
) => ({
  description: "Test Factory",
  schemas: {
    state: ZodEmpty,
    commands: {
      Command1: ZodEmpty,
      Command2: ZodEmpty
    },
    events: {
      Event1: ZodEmpty,
      Event2: ZodEmpty
    }
  },
  stream: "TestFactory-".concat(stream),
  init: () => ({}),
  reduce: {
    Event1: () => ({}),
    Event2: () => ({})
  },
  on: {
    Command1: () => Promise.resolve([]),
    Command2: () => Promise.resolve([])
  }
});
const Factory2: AggregateFactory<State, Commands, Events> = (id: string) => ({
  ...Factory(id)
});
const Policy1: PolicyFactory<
  Pick<Commands, "Command1">,
  Pick<Events, "Event1">
> = () => ({
  description: "Policy",
  schemas: {
    events: { Event1: ZodEmpty },
    commands: { Command1: ZodEmpty }
  },
  on: {
    Event1: () => Promise.resolve(undefined)
  }
});

describe("Builder", () => {
  afterEach(async () => {
    await dispose()();
  });

  it("should throw duplicate artifact", () => {
    app().with(Factory);
    expect(() => app().with(Factory)).toThrow('Duplicate artifact "Factory"');
  });

  it("should throw duplicate command", () => {
    app().with(Factory);
    expect(() => app().with(Factory2)).toThrow(
      'Duplicate command "Command1" found in "Factory" and "Factory2"'
    );
  });

  it("should set default scopes", () => {
    config().env = "development";
    app().with(Factory).with(Policy1).build();
    const artifacts = app().artifacts;
    expect(artifacts.get("Factory")?.inputs).toStrictEqual([
      { name: "Command1", scope: "private" },
      { name: "Command2", scope: "public" }
    ]);
    expect(artifacts.get("Policy1")?.inputs).toStrictEqual([
      { name: "Event1", scope: "private" }
    ]);
    config().env = "test";
  });
});
