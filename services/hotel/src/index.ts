import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import {
  PostgresProjectorStore,
  PostgresStore
} from "@rotorsoft/eventually-pg";
import { Hotel, RoomState } from "./Hotel.projector";
import { Room } from "./Room.aggregate";

void bootstrap(async (): Promise<void> => {
  store(PostgresStore("hotel"));
  const pgProjectorStore = PostgresProjectorStore<RoomState>(
    "hotel_projection",
    {
      id: 'varchar(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY',
      type: 'varchar(20) COLLATE pg_catalog."default"',
      number: "int",
      price: "int",
      reserved: "json"
    },
    `CREATE INDEX IF NOT EXISTS hotel_projection_type_ix ON public.hotel_projection USING btree ("type" ASC) TABLESPACE pg_default;`
  );
  await store().seed();
  await pgProjectorStore.seed();

  app(new ExpressApp())
    .with(Room)
    .with(Hotel)
    .withStore(Hotel, pgProjectorStore)
    .build();
  await app().listen();
});
