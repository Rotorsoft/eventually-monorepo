# Eventually Monorepo

![Build Status](https://github.com/rotorsoft/eventually-monorepo/actions/workflows/ci-cd.yml/badge.svg?branch=master)
![CodeQL Status](https://github.com/rotorsoft/eventually-monorepo/actions/workflows/codeql-analysis.yml/badge.svg?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/Rotorsoft/eventually-monorepo/badge.svg?branch=master)](https://coveralls.io/github/Rotorsoft/eventually-monorepo?branch=master)

## Writing a Hotel Reservation System

This tutorial was inspired by [https://medium.com/thedevproject/clean-architecture-a-basic-example-of-folders-organization-aab07f9eea68](https://medium.com/thedevproject/clean-architecture-a-basic-example-of-folders-organization-aab07f9eea68). Here we show a different approach to coding the same service using [Eventually](./libs/eventually/README.md).

### **1** Domain Model

> We recommend using [Event Storming](https://www.eventstormingcom/) or [Event Modeling](https://eventmodeling.org/) to clearly define `what` we are trying to build in simple `business friendly` terms.

* A hotel adminstrator can open rooms to reservations via `OpenRoom` commands
* A `Room` aggregate receives `BookRoom` commands from customers and emits `RoomBooked` events when the room is available
* Events are projected into a `Hotel` read model
* Customers query `Hotel` for available rooms via `SearchRoom` query commands

![Hotel Reservation System Model](./assets/hotel.png)

### **2** Schemas

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
  reservations?: Reservation[];
}

export type Hotel = Record<number, Room>;
```

* Messages also have payloads defined and validated by schemas

```typescript
export type OpenRoom = Room;
export type BookRoom = Reservation & { number: number };
export type RoomOpened = Room;
export type RoomBooked = Reservation & { number: number };
export type SearchRoom = Pick<Reservation, "checkin" | "checkout">;
```

### **3** Transfer Model to Code

* Create Typescript project

```bash
mkdir hotel
cd hotel
npm init # follow prompt
npx tsc --init
npm i --save joi @rotorsoft/eventually @rotorsoft/eventually-express
npm i --save-dev ts-node-dev jest @types/jest
```

`package.json`

```json
{
  "name": "hotel",
  "version": "1.0.0",
  "description": "Hotel Reservation System",
  "main": "index.js",
  "scripts": {
    "start:dev": "npx ts-node-dev --respawn ./src/index.ts",
    "test": "npx tsc && jest ./dist/**/*.spec.js"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@rotorsoft/eventually": "^4.2.1",
    "@rotorsoft/eventually-express": "^4.1.1",
    "joi": "^17.6.3"
  },
  "devDependencies": {
    "@types/jest": "^29.1.2",
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
    "skipLibCheck": true,
    "sourceRoot": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

* Add a dummy entry point `./src/index.ts`

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

`./src/Room.models.ts`

```typescript
export enum RoomType {
  SINGLE = "single",
  DOUBLE = "double",
  DELUXE = "deluxe",
}

export type Reservation = {
  id: string;
  checkin: Date;
  checkout: Date;
  totalPrice: number;
};

export type Room = {
  number: number;
  type: RoomType;
  price: number;
  reservations?: Reservation[];
};

export type SearchRoom = Pick<Reservation, "checkin" | "checkout">;
```

`./src/Room.schemas.ts`

```typescript
import joi from "joi";
import * as models from "./Room.models";

export const Reservation = joi
  .object<models.Reservation>({
    id: joi.string(),
    checkin: joi.date(),
    checkout: joi.date(),
    totalPrice: joi.number(),
  })
  .presence("required");

export const Room = joi
  .object<models.Room>({
    number: joi.number(),
    type: joi.valid(...Object.values(models.RoomType)),
    price: joi.number(),
    reservations: joi.array().optional().items(Reservation),
  })
  .presence("required");

export const BookRoom = joi
  .object({
    number: joi.number().required(),
  })
  .concat(Reservation);

export const RoomBooked = BookRoom;

export const SearchRoom = joi
  .object<models.SearchRoom>({
    checkin: joi.date(),
    checkout: joi.date(),
  })
  .presence("required");
```

`./src/Room.commands.ts`

```typescript
import { Reservation, Room } from "./Room.models";

export type RoomCommands = {
  OpenRoom: Room;
  BookRoom: Reservation & { number: number };
};
```

`./src/Room.events.ts`

```typescript
import { Reservation, Room } from "./Room.models";

export type RoomEvents = {
  RoomOpened: Room;
  RoomBooked: Reservation & { number: number };
};
```

`./src/Room.aggregate.ts` - dummy version

```typescript
import { Aggregate } from "@rotorsoft/eventually";
import { RoomCommands } from "./Room.commands";
import { RoomEvents } from "./Room.events";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";

export const Room = (
  id: string
): Aggregate<models.Room, RoomCommands, RoomEvents> => ({
  schemas: {
    state: schemas.Room,
    OpenRoom: schemas.Room,
    BookRoom: schemas.BookRoom,
    RoomOpened: schemas.Room,
    RoomBooked: schemas.RoomBooked,
  },

  stream: () => `Room-${id}`,
  init: (): models.Room => ({
    number: +id,
    type: models.RoomType.SINGLE,
    price: 0,
  }),

  onOpenRoom: () => Promise.resolve([]),
  onBookRoom: () => Promise.resolve([]),

  applyRoomOpened: () => undefined,
  applyRoomBooked: () => undefined,
});
```

* Register aggregate with app builder

```typescript
import { app, bootstrap } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Room } from "./Room.aggregate";

void bootstrap(async (): Promise<void> => {
  app(new ExpressApp()).withAggregate(Room, "Hotel Room").build();
  await app().listen();
});
```

* Check endpoints

```bash
LOG_LEVEL="trace" npm run start:dev
```

Expect to see the following endpoints in the console trace

```bash
POST /room/:id/book-room
GET  /room/:id
GET  /room/:id/stream
GET  /all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]
GET  /stats
```

### **4** Write Tests

> Place your tests under `/src/__tests__`

```typescript
import {
  app,
  bind,
  dispose,
  InMemorySnapshotStore,
  Snapshot,
} from "@rotorsoft/eventually";
import { Room } from "../Room.aggregate";
import * as models from "../Room.models";

const openRoom = (room: models.Room): Promise<Snapshot<models.Room>[]> =>
  app().command(bind("OpenRoom", room, room.number.toString()));

const bookRoom = (
  number: number,
  reservation: models.Reservation
): Promise<Snapshot<models.Room>[]> =>
  app().command(
    bind("BookRoom", { number, ...reservation }, number.toString())
  );

describe("Room", () => {
  const snapshotStore = InMemorySnapshotStore();

  beforeAll(async () => {
    app()
      .withAggregate(Room, "Hotel Room", {
        store: snapshotStore,
        threshold: -1,
      })
      .build();
    await app().listen();

    await openRoom({ number: 101, price: 100, type: models.RoomType.SINGLE });
    await openRoom({ number: 102, price: 200, type: models.RoomType.DOUBLE });
    await openRoom({ number: 103, price: 300, type: models.RoomType.DELUXE });
  });

  afterAll(async () => {
    await dispose();
  });

  it("should search rooms", async () => {
    const rooms = await snapshotStore.query({});
    expect(rooms.length).toBe(3);
  });

  it("should book room", async () => {
    const checkin = new Date();
    const checkout = new Date(checkin.getTime() + 2 * 24 * 60 * 60 * 1000);
    const room = await bookRoom(102, {
      id: "r1",
      checkin,
      checkout,
      totalPrice: 0,
    });
    expect(room[0].state?.reservations?.length).toBe(1);
    expect(room[0].state?.reservations[0].totalPrice).toBe(
      2 * room[0].state.price
    );
  });

  it("should fail booking", async () => {
    const checkin = new Date();
    const checkout = new Date(checkin.getTime() + 2 * 24 * 60 * 60 * 1000);
    await bookRoom(103, {
      id: "r2",
      checkin,
      checkout,
      totalPrice: 0,
    });
    expect(
      bookRoom(103, {
        id: "r3",
        checkin,
        checkout,
        totalPrice: 0,
      })
    ).rejects.toThrowError();
  });
});
```

The new project structure will look like this

![Hotel Project](./assets/hotel-project.png)

### **5** Finish Service

* Finish Room aggregate

```typescript
import { Aggregate, bind } from "@rotorsoft/eventually";
import { RoomCommands } from "./Room.commands";
import { RoomEvents } from "./Room.events";
import * as schemas from "./Room.schemas";
import * as models from "./Room.models";

const dayDiff = (reservation: models.Reservation): number => {
  const diffInTime =
    reservation.checkout.getTime() - reservation.checkin.getTime();
  return Math.round(diffInTime / (1000 * 3600 * 24));
};

const isBooked = (room: models.Room, from: Date, to: Date): boolean => {
  return (
    room.reservations &&
    room.reservations.some(
      (r) =>
        (from >= r.checkin && from <= r.checkout) ||
        (to >= r.checkin && to <= r.checkout) ||
        (r.checkin >= from && r.checkin <= to) ||
        (r.checkout >= from && r.checkout <= to)
    )
  );
};

export const Room = (
  id: string
): Aggregate<models.Room, RoomCommands, RoomEvents> => ({
  schemas: {
    state: schemas.Room,
    OpenRoom: schemas.Room,
    BookRoom: schemas.BookRoom,
    RoomOpened: schemas.Room,
    RoomBooked: schemas.RoomBooked,
  },

  stream: () => `Room-${id}`,
  init: (): models.Room => ({
    number: +id,
    type: models.RoomType.SINGLE,
    price: 0,
  }),

  onOpenRoom: async (data, state) => [bind("RoomOpened", data)],
  onBookRoom: async (data, state) => {
    if (isBooked(state, data.checkin, data.checkout))
      throw Error(`Room ${state.number} is booked.`);
    return [bind("RoomBooked", data)];
  },

  applyRoomOpened: (state, event) => event.data,
  applyRoomBooked: (state, event) => ({
    ...state,
    reservations: (state?.reservations || []).concat({
      ...event.data,
      totalPrice: dayDiff(event.data) * state.price,
    }),
  }),
});
```

* Finish Hotel Projection - TODO

In this first pass we are using the snapshot store to represent the `Hotel` projection with limited querying capabilities. Future versions of the framework will provide app builder functions to define projections and queries.

* Unit Test

At this point all unit tests should pass covering most of the code

![Unit Test Coverage](./assets/coverage.png)

* Test with Postman - TODO
