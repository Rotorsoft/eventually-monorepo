import {
  AggregateFactory,
  app,
  dispose,
  Empty,
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
const Factory: AggregateFactory<State, Commands, Events> = (id: string) => ({
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
  stream: () => "TestFactory-".concat(id),
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

describe("Builder", () => {
  afterEach(async () => {
    await dispose()();
  });

  it("should throw duplicate artifact", () => {
    app().with(Factory);
    expect(() => app().with(Factory)).toThrowError(
      'Duplicate artifact "Factory"'
    );
  });

  it("should throw duplicate command", () => {
    app().with(Factory);
    expect(() => app().with(Factory2)).toThrowError(
      'Duplicate command "Command1" found in "Factory" and "Factory2"'
    );
  });
});
