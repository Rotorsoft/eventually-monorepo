import { app, bootstrap, client, store } from "@rotorsoft/eventually";
import { MonthlyBookings } from "./monthly-bookings.policy";
import { Room } from "./room.aggregate";
import { requestBooking } from "./utils";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { exit } from "node:process";

const log = async (tries: number, stream: string): Promise<void> => {
  const { event, state } = await client().load(Room, stream);
  console.log(
    `${event?.id}: ${event?.stream}@${event?.version} ${event?.name} = ${state.status} [${tries}]`
  );
};

void bootstrap(async () => {
  const stream = `Room-${process.argv.at(-1)}`;
  await store(PostgresStore("pm")).seed();
  app().with(Room).with(MonthlyBookings, { scope: "private" }).build();
  let tries = 1;
  const [snap] = await requestBooking(stream);
  while (tries < 4) {
    try {
      snap.event && (await client().event(MonthlyBookings, snap.event));
      await log(tries, stream);
      break;
    } catch (error: any) {
      console.log(error.message);
      await log(tries, stream);
    }
    tries++;
  }
  exit(0);
});
