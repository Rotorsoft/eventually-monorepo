import { app, bootstrap, client, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import {
  PostgresProjectorStore,
  PostgresStore
} from "@rotorsoft/eventually-pg";
import path from "node:path";
import { Hotel, RoomState } from "./Hotel.projector";
import { Room } from "./Room.aggregate";
import { engine } from "express-handlebars";

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

  const express = app(new ExpressApp())
    .with(Room)
    .with(Hotel)
    .withStore(Hotel, pgProjectorStore)
    .build();

  // get some ui
  express.engine(
    "hbs",
    engine({
      extname: ".hbs"
    })
  );
  express.set("view engine", "hbs");
  express.set("views", path.resolve(__dirname, "./views"));
  express.get("/home", async (_, res) => {
    const rooms = await client().read(Hotel, [
      "Room-101",
      "Room-102",
      "Room-103",
      "Room-104",
      "Room-105"
    ]);
    console.log(rooms);
    res.render("home", {
      rooms: Object.values(rooms)
        .map((r) => r.state)
        .map(({ number, type, price, reserved }) => ({
          number,
          type,
          price,
          reserved: Object.entries(reserved || {})
            .map(([day, id]) => ({ day, id }))
            .sort()
        }))
        .sort((a, b) => a.number - b.number)
    });
  });

  await app().listen();
});
