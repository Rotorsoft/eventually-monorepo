import { Command, CommittedEvent } from "@rotorsoft/eventually";

type Events = {
  DigitPressed: { digit: string };
};

export const events: CommittedEvent<Events>[] = [
  {
    id: 1,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Calculator-calc1",
    version: 0,
    created: new Date("2022-06-15T02:09:05.284Z"),
    metadata: {
      correlation: "q6D7pjTihIkA3ELDTX0ekhNr",
      causation: {
        command: {
          name: "PressKey",
          stream: "calc1"
        } as Command
      }
    }
  },
  {
    id: 2,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Calculator-calc1",
    version: 1,
    created: new Date("2022-06-15T02:09:08.646Z"),
    metadata: {
      correlation: "cH3TfALeTvkSg30h2x5I1tmY",
      causation: {
        command: {
          name: "PressKey",
          stream: "calc1"
        } as Command
      }
    }
  },
  {
    id: 3,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Calculator-calc1",
    version: 2,
    created: new Date("2022-06-15T02:09:09.598Z"),
    metadata: {
      correlation: "LppvLAdbQaPbLvS4xNDVVK9d",
      causation: {
        command: {
          name: "PressKey",
          stream: "calc1"
        } as Command
      }
    }
  },
  {
    id: 4,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Counter-Calculator-calc1",
    version: 0,
    created: new Date("2022-06-15T02:09:39.773Z"),
    metadata: {
      correlation: "q6D7pjTihIkA3ELDTX0ekhNr",
      causation: {
        event: {
          name: "DigitPressed",
          stream: "Calculator-calc1",
          id: 1
        }
      }
    }
  },
  {
    id: 5,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Counter-Calculator-calc1",
    version: 1,
    created: new Date("2022-06-15T02:09:39.843Z"),
    metadata: {
      correlation: "cH3TfALeTvkSg30h2x5I1tmY",
      causation: {
        event: {
          name: "DigitPressed",
          stream: "Calculator-calc1",
          id: 2
        }
      }
    }
  },
  {
    id: 6,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Counter-Calculator-calc1",
    version: 2,
    created: new Date("2022-06-15T02:09:39.859Z"),
    metadata: {
      correlation: "LppvLAdbQaPbLvS4xNDVVK9d",
      causation: {
        event: {
          name: "DigitPressed",
          stream: "Calculator-calc1",
          id: 3
        }
      }
    }
  },
  {
    id: 7,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Calculator-calc1",
    version: 3,
    created: new Date("2022-06-15T02:09:50.286Z"),
    metadata: {
      correlation: "RPUvuoUkhFqK039IAyESIRNG",
      causation: {
        command: {
          name: "PressKey",
          stream: "calc1"
        } as Command
      }
    }
  },
  {
    id: 8,
    name: "DigitPressed",
    data: {
      digit: "1"
    },
    stream: "Counter-Calculator-calc1",
    version: 3,
    created: new Date("2022-06-15T02:09:50.386Z"),
    metadata: {
      correlation: "RPUvuoUkhFqK039IAyESIRNG",
      causation: {
        event: {
          name: "DigitPressed",
          stream: "Calculator-calc1",
          id: 7
        }
      }
    }
  }
];
