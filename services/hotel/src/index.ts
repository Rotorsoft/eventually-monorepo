import { app, bootstrap } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Hotel } from "./Hotel.projector";
import { Room } from "./Room.aggregate";

void bootstrap(async (): Promise<void> => {
  app(new ExpressApp()).with(Room).with(Hotel).build();
  await app().listen();
});
