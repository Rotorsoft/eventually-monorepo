import { app, bootstrap, seed } from "@rotorsoft/eventually";
import { ExpressApp, sse } from "@rotorsoft/eventually-express";
import path from "node:path";
import { Hotel } from "./Hotel.projector";
import { Room } from "./Room.aggregate";
import { engine } from "express-handlebars";
import { Next30Days } from "./Next30Days.projector";
import * as routes from "./routes";
import { HomeView, readHomeView } from "./utils";
import { PostgresProjectorStore } from "@rotorsoft/eventually-pg";

void bootstrap(async (): Promise<void> => {
  const express = app(new ExpressApp())
    .with(Room)
    .with(Hotel, {
      projector: {
        store: PostgresProjectorStore("hotel"),
        indexes: [{ type: "asc" }]
      }
    })
    .with(Next30Days, {
      projector: { store: PostgresProjectorStore("next30"), indexes: [{}] }
    })
    .build();

  await seed();

  // get some ui to play with it
  express.engine(
    "hbs",
    engine({
      extname: ".hbs"
    })
  );
  express.set("view engine", "hbs");
  express.set("views", path.resolve(__dirname, "./views"));
  express.get("/home", routes.home);

  // setup a SSE monitor to update gui
  const mon = sse<HomeView>("monitor");
  express.get("/monitor", (req, res) => {
    mon.push(req, res);
  });

  app().on("projection", async ({ factory, results }) => {
    console.log(factory.name, results);
    const state = await readHomeView();
    mon.send(state);
  });

  await app().listen();
});
