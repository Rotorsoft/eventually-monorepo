import { app, bootstrap, InMemorySnapshotStore } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Room } from "./Room.aggregate";

void bootstrap(async (): Promise<void> => {
  app(new ExpressApp())
    .with(Room)
    .withSnapshot(Room, {
      store: InMemorySnapshotStore(),
      threshold: -1,
      expose: true
    })
    .build();
  await app().listen();
});
