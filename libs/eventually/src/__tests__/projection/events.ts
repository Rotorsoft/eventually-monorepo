import { z } from "zod";
import * as schemas from "./schemas";

export type CustomerEvents = {
  CustomerCreated: z.infer<typeof schemas.CustomerCreated>;
  CustomerNameChanged: z.infer<typeof schemas.CustomerNameChanged>;
};

export type SupplierEvents = {
  SupplierCreated: z.infer<typeof schemas.SupplierCreated>;
  SupplierNameChanged: z.infer<typeof schemas.SupplierNameChanged>;
};

export type JobEvents = {
  JobCreated: z.infer<typeof schemas.JobCreated>;
  JobTitleChanged: z.infer<typeof schemas.JobTitleChanged>;
  JobManagerChanged: z.infer<typeof schemas.JobManagerChanged>;
};

export type MatchEvents = {
  MatchCreated: z.infer<typeof schemas.MatchCreated>;
};
