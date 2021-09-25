## Eventually Framework

This project aims at the exploration of different ideas around building reactive web services. Based on well known methodologies, patterns, and tools - our guiding principle is **simplicity**.

##### Methodologies-Patterns-Tools

- Domain Driven Design - DDD
- Event Storming
- Event Sourcing
- Command Query Responsibility Segregation - CQRS
- TypeScript 3 Project References
- Yarn 2 Zero Installs, Plug and Play, Workspaces
- Monorepo Structure
- Test Driven Development - TDD
- ESLint, Prettier, Jest
- ...More to come

### Logical Model

Software engineering should be approached as a “group learning process”, a close collaboration among clients, domain experts, and engineers that iteratively produces “clear models” as the drivers of implementations - source code should be seen as a side effect. The deeper we can track these models within the implementation the better.

> Tackle complexity early by understanding the domain

Event Sourcing is a practical methodology used by many to model business processes. The nice thing about it is how easiliy models get tranferred to source code. The working patterns of any reactive system can be identified in the diagram below using the colors prescribed by Event Storming:

![Logical Model](./assets/flow.png)

### Value Proposition

This project is trying to answer the following questions:

- **Future Proof Single Source of Truth** - The “append-only” nature of an Event Store is a very old and battle tested concept. We can audit and fully reproduce/re-project our business history by just replaying the log/ledger.

- **Transparent Model-To-Implementation Process** - Developers focus on transferring business models to code with minimal technical load. We use a “convention over configuration” philosophy to remove tedious technical decision making from the process

- **Ability to Swap Platform Services** - Frameworks, protocols, and other platform related services are abstracted away from the developer

- **Practically Self-Testable** - Replaying event streams effectively tests/covers models and business rules - one generic unit test

### Building your first Micro-Service

> The anatomy of a micro-service should reflect the business model

##### Bootstraps the micro-service `index.ts`

- Command handlers are routed by convention `/aggregate-type/:id/command-name`

- Event handlers follow a similar approach `/policy-or-projector-type/event-name`

```typescript
import { App, config } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

const app = App(new ExpressApp(PostgresStore(), PubSubBroker()));

app.withAggregate(Calculator, commands);
app.withPolicy(Counter, events);

export const express = app.build();

if (express && !config.host.endsWith("cloudfunctions.net/calculator"))
  express.listen(config.port, () => {
    app.log.info("Express app is listening", config);
  });
```

#### Testing your code

We group our unit tests inside the `__tests__` folder. We want tests only focusing on application logic, and we are planning to provide tooling to facilitate this. The `test_command` utility simulates commands flows in memory and covers messages payload validations automatically.

```typescript
import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

describe("Counter", () => {
  const app = App();
  app.withAggregate(Calculator, commands);
  app.withPolicy(Counter, events);

  it("should return Reset on DigitPressed", async () => {
    const c = Calculator("test");
    await test_command(c, commands.PressKey({ key: "1" }));
    await test_command(c, commands.PressKey({ key: "1" }));
    await test_command(c, commands.PressKey({ key: "2" }));
    await test_command(c, commands.PressKey({ key: "." }));
    await test_command(c, commands.PressKey({ key: "3" }));

    const { state } = await app.load(c);
    expect(state).toEqual({ result: 0 });
  });
});
```
