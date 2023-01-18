import { z } from "zod";

// state

export const Customer = z.object({
  id: z.number(),
  name: z.string().min(5)
});

export const Supplier = z.object({
  id: z.number(),
  name: z.string().min(5)
});

export const Job = z.object({
  id: z.number(),
  customerId: z.number(),
  title: z.string().min(5),
  manager: z.string().min(5)
});

export const Match = z.object({
  id: z.number(),
  jobId: z.number(),
  supplierId: z.number()
});

export const MatchProjection = z.object({
  id: z.string(),
  jobId: z.number(),
  jobTitle: z.string().min(5),
  manager: z.string().min(5),
  customerId: z.number(),
  customerName: z.string().min(5),
  supplierId: z.number(),
  supplierName: z.string().min(5)
});

// events

export const CustomerCreated = Customer;
export const CustomerNameChanged = Customer;

export const SupplierCreated = Supplier;
export const SupplierNameChanged = Supplier;

export const JobCreated = Job;
export const JobTitleChanged = z.object({
  id: z.number(),
  title: z.string().min(5)
});
export const JobManagerChanged = z.object({
  id: z.number(),
  manager: z.string().min(5)
});

export const MatchCreated = Match;
