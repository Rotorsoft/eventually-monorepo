## Eventually Framework

This is a pet project aiming at the exploration of different ideas around building reactive web services. We use well known methodologies, patterns, and tools (listed below). Our guiding principle is **simplicity**.

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

![Logical Model](/assets/flow.png)

### Value Proposition

This project is trying to answer the following questions:

- **Future Proof Single Source of Truth** - The “append-only” nature of an Event Store is a very old and battle tested concept. We can audit and fully reproduce/re-project our business history by just replaying the log/ledger.

- **Transparent Model-To-Implementation Process** - Developers focus on transferring business models to code with minimal technical load. We use a “convention over configuration” philosophy to remove tedious technical decision making from the process

- **Ability to Swap Platform Services** - Frameworks, protocols, and other platform related services are abstracted away from the developer

- **Practically Self-Testable** - Replaying event streams effectively tests/covers models and business rules - one generic unit test

### Configuring VS Code

You can customize your workbech by copying the custom [vsicons](https://marketplace.visualstudio.com/items?itemName=vscode-icons-team.vscode-icons) and settings under `./vscode` to your local VSCode user directory. This will validate the folder structure and naming conventions we are proposing to follow when building new micro-services as shown below:

![Microservice Structure](/assets/microservice.png)

### Building your first Micro-Service

> The anatomy of a micro-service should reflect the business model

We recommend a monorepo structure like this one. A `calculator` service can be used as the starting point to other services.

#### Project Structure

We recommend the following project structure for consistency. Start by defining your models and validation schemas, then write your aggregates and policies. Follow TDD practices and the Test utility to acomplish 100% code coverage.

```
./src
  __mocks__
  __tests__
  /Aggregates
  /Policies
  /Projectors (optional)
  /Schemas
  App.ts
```

##### Bootstraps the micro-service `App.ts`

Command handlers will be routed following our aggregate naming convention `/aggregate-type/:id/command-name`

Event handlers will follow a similar approach `/policy-or-projector-type/event-name`

```typescript
import { App } from "@rotorsoft/eventually";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";
import { Counter } from "./Policies/Counter";
import { CalculatorEventsFactory } from "./Aggregates/Calculator.Events";
import { CalculatorProjector } from "./Projectors/Calculator.Projector";

const app = App();

const routes = async (): Promise<void> => {
  await app.routeAggregate(Calculator, CalculatorCommandsFactory);
  await app.routePolicy(Counter, CalculatorEventsFactory);
  await app.routeProjector(CalculatorProjector, CalculatorEventsFactory);
};

void routes().then(() => app.listen());
```

Run `yarn ./services/calculator start` and you should see a running micro-service with blue command handlers and red event handlers ready to receive messages

#### Testing your code

// TODO
