import { z } from "zod";
import { ProjectionRecord, Projector } from "../../types";
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
      const records: ProjectionRecord<MatchProjection>[] = [];
      await client().read(MatchProjector, customerId, (r) => records.push(r));
      const customer = records[0];
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
      const records: ProjectionRecord<MatchProjection>[] = [];
      await client().read(MatchProjector, [jobId, supplierId], (r) =>
        records.push(r)
      );
      const job = records[0];
      const supplier = records[1];
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
