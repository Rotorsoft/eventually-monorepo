import { z } from "zod";
import { Projector } from "../../types";
import * as schemas from "./schemas";
import * as events from "./events";
import { client } from "../..";

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
  on: {
    CustomerCreated: (e) =>
      Promise.resolve({
        upserts: [
          {
            where: { id: e.stream },
            values: { customerId: e.data.id, customerName: e.data.name }
          }
        ]
      }),
    CustomerNameChanged: (e) =>
      Promise.resolve({
        upserts: [
          {
            where: { customerId: e.data.id },
            values: { customerName: e.data.name }
          }
        ]
      }),
    SupplierCreated: (e) =>
      Promise.resolve({
        upserts: [
          {
            where: { id: e.stream },
            values: { supplierId: e.data.id, supplierName: e.data.name }
          }
        ]
      }),
    SupplierNameChanged: (e) =>
      Promise.resolve({
        upserts: [
          {
            where: { supplierId: e.data.id },
            values: { supplierName: e.data.name }
          }
        ]
      }),
    JobCreated: async (e) => {
      const customerId = `Customer-${e.data.customerId}`;
      const records = await client().read(MatchProjector, [customerId]);
      const customer = records[customerId];
      return Promise.resolve({
        upserts: [
          {
            where: { id: e.stream },
            values: {
              jobId: e.data.id,
              jobTitle: e.data.title,
              manager: e.data.manager,
              customerId: e.data.customerId,
              customerName: customer?.state.customerName
            }
          }
        ]
      });
    },
    JobTitleChanged: (e) =>
      Promise.resolve({
        upserts: [
          { where: { jobId: e.data.id }, values: { jobTitle: e.data.title } }
        ]
      }),
    JobManagerChanged: (e) =>
      Promise.resolve({
        upserts: [
          { where: { jobId: e.data.id }, values: { manager: e.data.manager } }
        ]
      }),
    MatchCreated: async (e) => {
      const jobId = `Job-${e.data.jobId}`;
      const supplierId = `Supplier-${e.data.supplierId}`;
      const records = await client().read(MatchProjector, [jobId, supplierId]);
      const job = records[jobId];
      const supplier = records[supplierId];
      return Promise.resolve({
        upserts: [
          {
            where: { id: e.stream },
            values: {
              jobId: e.data.jobId,
              jobTitle: job?.state.jobTitle,
              manager: job?.state.manager,
              customerId: job?.state.customerId,
              customerName: job?.state.customerName,
              supplierId: e.data.supplierId,
              supplierName: supplier?.state.supplierName
            }
          }
        ]
      });
    }
  }
});
