import { z } from "zod";
import { Projector } from "../../types";
import * as schemas from "./schemas";
import * as events from "./events";

export type MatchProjection = z.infer<typeof schemas.MatchProjection>;
export type MatchProjectionEvents = Pick<
  events.CustomerEvents,
  "CustomerCreated"
> &
  Pick<events.SupplierEvents, "SupplierCreated"> &
  Pick<events.JobEvents, "JobCreated"> &
  Pick<events.MatchEvents, "MatchCreated">;

export const MatchProjector = (): Projector<
  MatchProjection,
  MatchProjectionEvents
> => ({
  description: "Match projector",
  schemas: {
    state: schemas.MatchProjection,
    events: {
      CustomerCreated: schemas.CustomerCreated,
      SupplierCreated: schemas.SupplierCreated,
      JobCreated: schemas.JobCreated,
      MatchCreated: schemas.MatchCreated
    }
  },
  on: {
    CustomerCreated: ({ stream, data }) =>
      Promise.resolve([{ id: stream, customerId: data.id }]),
    SupplierCreated: ({ stream, data }) =>
      Promise.resolve([
        {
          id: stream,
          supplierId: data.id
        }
      ]),
    JobCreated: ({ stream, data }) => {
      return Promise.resolve([
        {
          id: stream,
          jobId: data.id,
          customerId: data.customerId,
          manager: data.manager
        }
      ]);
    },
    MatchCreated: async ({ stream, data }) => {
      return Promise.resolve([
        {
          id: stream,
          jobId: data.jobId,
          supplierId: data.supplierId
        }
      ]);
    }
  }
});
