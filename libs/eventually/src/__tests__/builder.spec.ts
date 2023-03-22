import {
  AggregateFactory,
  app,
  dispose,
  Empty,
  PolicyFactory,
  Scope,
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
    commands: { Command1: "" }
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
    process.env.NODE_ENV = "development";
    app().with(Factory).with(Policy1).build();
    const artifacts = app().artifacts;
    expect(artifacts["Factory"].inputs).toStrictEqual([
      { name: "Command1", scope: Scope.private },
      { name: "Command2", scope: Scope.public }
    ]);
    expect(artifacts["Policy1"].inputs).toStrictEqual([
      { name: "Event1", scope: Scope.private }
    ]);
    process.env.NODE_ENV = "test";
  });
});
