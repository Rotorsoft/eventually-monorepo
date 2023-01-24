import { store } from "@rotorsoft/eventually";
import {
  PostgresProjectorStore,
  PostgresStore
} from "@rotorsoft/eventually-pg";
import { RoomState } from "./Hotel.projector";
import { DaySales } from "./Next30Days.projector";

store(PostgresStore("hotel"));

export const pgHotelProjectorStore = PostgresProjectorStore<RoomState>(
  "hotel_rooms",
  {
    id: 'varchar(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY',
    type: 'varchar(20) COLLATE pg_catalog."default"',
    number: "int",
    price: "int",
    reserved: "json"
  },
  `CREATE INDEX IF NOT EXISTS hotel_projection_type_ix ON public.hotel_rooms USING btree ("type" ASC) TABLESPACE pg_default;`
);

export const pgNext30ProjectorStore = PostgresProjectorStore<DaySales>(
  "hotel_daysales",
  {
    id: 'varchar(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY',
    total: "int",
    reserved: "int[]"
  },
  ""
);
