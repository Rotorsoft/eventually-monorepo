import { z } from "zod";
import { Projector } from "../../types";
import * as schemas from "./schemas";
import * as events from "./events";

export type MatchProjection = z.infer<typeof schemas.MatchProjection>;
export type MatchProjectionEvents = events.CustomerEvents &
  events.SupplierEvents &
  events.JobEvents &
  events.MatchEvents;

export const MatchProjector = (): Projector<
  MatchProjection,
  MatchProjectionEvents
> => ({
  description: "Match projector",
  schemas: {
    state: schemas.MatchProjection,
    events: {
      CustomerCreated: schemas.CustomerCreated,
      CustomerNameChanged: schemas.CustomerNameChanged,
      SupplierCreated: schemas.SupplierCreated,
      SupplierNameChanged: schemas.SupplierNameChanged,
      JobCreated: schemas.JobCreated,
      JobTitleChanged: schemas.JobTitleChanged,
      JobManagerChanged: schemas.JobManagerChanged,
      MatchCreated: schemas.MatchCreated
    }
  },
  load: {
    JobCreated: (e) => [`Customer-${e.data.customerId}`],
    MatchCreated: (e) => [
      `Job-${e.data.jobId}`,
      `Supplier-${e.data.supplierId}`
    ]
  },
  on: {
    CustomerCreated: (e) => ({
      upsert: [
        { id: e.stream },
        { customerId: e.data.id, customerName: e.data.name }
      ]
    }),
    CustomerNameChanged: (e) => ({
      upsert: [{ customerId: e.data.id }, { customerName: e.data.name }]
    }),
    SupplierCreated: (e) => ({
      upsert: [
        { id: e.stream },
        { supplierId: e.data.id, supplierName: e.data.name }
      ]
    }),
    SupplierNameChanged: (e) => ({
      upsert: [{ supplierId: e.data.id }, { supplierName: e.data.name }]
    }),
    JobCreated: (e, r) => {
      const customer = r[`Customer-${e.data.customerId}`];
      return {
        upsert: [
          { id: e.stream },
          {
            jobId: e.data.id,
            jobTitle: e.data.title,
            manager: e.data.manager,
            customerId: e.data.customerId,
            customerName: customer?.state.customerName
          }
        ]
      };
    },
    JobTitleChanged: (e) => ({
      upsert: [{ jobId: e.data.id }, { jobTitle: e.data.title }]
    }),
    JobManagerChanged: (e) => ({
      upsert: [{ jobId: e.data.id }, { manager: e.data.manager }]
    }),
    MatchCreated: (e, r) => {
      const job = r[`Job-${e.data.jobId}`];
      const supplier = r[`Supplier-${e.data.supplierId}`];
      return {
        upsert: [
          { id: e.stream },
          {
            jobId: e.data.jobId,
            jobTitle: job?.state.jobTitle,
            manager: job?.state.manager,
            customerId: job?.state.customerId,
            customerName: job?.state.customerName,
            supplierId: e.data.supplierId,
            supplierName: supplier?.state.supplierName
          }
        ]
      };
    }
  }
});
