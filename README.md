# Eventually Monorepo

![Build Status](https://github.com/rotorsoft/eventually-monorepo/actions/workflows/ci-cd.yml/badge.svg?branch=master)
![CodeQL Status](https://github.com/rotorsoft/eventually-monorepo/actions/workflows/codeql-analysis.yml/badge.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/eventually-monorepo/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/eventually-monorepo?branch=master)

## Writing a Hotel Reservation System

This tutorial was inspired by [https://medium.com/thedevproject/clean-architecture-a-basic-example-of-folders-organization-aab07f9eea68](https://medium.com/thedevproject/clean-architecture-a-basic-example-of-folders-organization-aab07f9eea68). Here we show a different approach to coding the same service using [Eventually](./libs/eventually/README.md).

### **Step 1**. Domain Model

> We recommend using [Event Storming](https://www.eventstormingcom/) or [Event Modeling](https://eventmodeling.org/) to clearly define `what` we are trying to build in simple `business friendly` terms.

* A `Room` aggregate receives `BookRoom` commands from customers and emits `RoomBooked` events when the room is available
* Events are projected into a `Hotel` read model
* Customers query `Hotel` for available rooms via `SearchRoom` query commands

![Hotel Reservation System Model](./assets/hotel.png)

### **Step 2**. Schemas

* `Aggregates` and `Read Models` are event projections backed by data models with a schema

```typescript
export enum RoomType {
  SINGLE = 'single', 
  DOUBLE = 'double', 
  DELUXE = 'deluxe'
}

export type Reservation = {
  id: string;
  checkin: Date;
  checkout: Date;
  totalPrice: number;
}

export type Room = {
  number: number;
  type: RoomType;
  price: number;
  reservations: Reservation[];
}

export type Hotel = Record<number, Room>;
```

* Messages also have payloads defined and validated by schemas

```typescript
export type BookRoom = Reservation & { number: number };
export type RoomBooked = Reservation & { number: number };
export type SearchRoom = Pick<Reservation, "checkin" | "checkout">;
```

### **Step 3**. Transfer Model to Code

* Create Typescript project

```bash
mkdir hotel
cd hotel
npm init # follow prompt
npx tsc --init
npm i --save joi @rotorsoft/eventually @rotorsoft/eventually-express
npm i --save-dev ts-node-dev jest
```

`package.json`

```json
{
  "name": "hotel",
  "version": "1.0.0",
  "description": "Hotel Reservation System",
  "main": "index.js",
  "scripts": {
    "start:dev": "npx ts-node-dev --respawn ./src/index.ts"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@rotorsoft/eventually": "^4.2.0",
    "@rotorsoft/eventually-express": "^4.1.0",
    "joi": "^17.6.3"
  },
  "devDependencies": {
    "jest": "^29.2.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "exclude": ["**/dist", "**/__mocks__", "**/__tests__"]
}
```

* Add entry point `./src/index.ts`

```typescript
import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";

app(new ExpressApp()).build();
void app().listen();
```

* Make sure it runs

```bash
LOG_LEVEL="trace" npm run start:dev
```

* Transfer model files

### **Step 4**. Write Tests

> Place your tests under `/src/__tests__`

* Test command handlers: GIVEN [events] WHEN [event] THEN [state]
* Test event handlers: WHEN [event] THEN [commands]

```typescript
import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import * as commands from "./accounts.commands";
import * as events from "./accounts.events";
import * as policies from "./accounts.policies";
import * as systems from "./accounts.systems";
import * as schemas from "./accounts.schemas";

app(new ExpressApp())
  .withSchemas<commands.Commands>({
    CreateAccount1: schemas.CreateAccount1,
    CreateAccount2: schemas.CreateAccount2,
    CreateAccount3: schemas.CreateAccount3,
    CompleteIntegration: schemas.CompleteIntegration
  })
  .withSchemas<events.Events>({
    AccountCreated: schemas.AccountCreated,
    Account1Created: schemas.Account1Created,
    Account2Created: schemas.Account2Created,
    Account3Created: schemas.Account3Created,
    IntegrationCompleted: schemas.IntegrationCompleted
  })
  .withEventHandlers(
    policies.IntegrateAccount1,
    policies.IntegrateAccount2,
    policies.IntegrateAccount3,
    policies.WaitForAllAndComplete
  )
  .withCommandHandlers(
    systems.ExternalSystem1,
    systems.ExternalSystem2,
    systems.ExternalSystem3,
    systems.ExternalSystem4
  )
  .build();

void app().listen();
```

### **Step 5**. Finish Service

At this point you can finish your service implementation
