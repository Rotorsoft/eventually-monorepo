import { projector } from "../../ports";
import { CommittedEvent, Messages } from "../../types";
import { MatchProjection, MatchProjectionEvents } from "./Match.projector";
import * as schemas from "./schemas";

const customerId1 = 101;
const customerId2 = 102;
const supplierId1 = 201;
const supplierId2 = 202;
const jobId1 = 301;
const jobId2 = 302;
const matchId1 = 401;
const matchId2 = 402;
const customerStream = (id: number): string => `Customer-${id}`;
const supplierStream = (id: number): string => `Supplier-${id}`;
const jobStream = (id: number): string => `Job-${id}`;
const matchStream = (id: number): string => `Match-${id}`;
const customerStream1 = customerStream(customerId1);
const customerStream2 = customerStream(customerId2);
const supplierStream1 = supplierStream(supplierId1);
const supplierStream2 = supplierStream(supplierId2);
const jobStream1 = jobStream(jobId1);
const jobStream2 = jobStream(jobId2);
const matchStream1 = matchStream(matchId1);
const matchStream2 = matchStream(matchId2);

export const trace = async (): Promise<void> => {
  const records = await projector().load<MatchProjection>([
    customerStream1,
    customerStream2,
    supplierStream1,
    supplierStream2,
    jobStream1,
    jobStream2,
    matchStream1,
    matchStream2
  ]);
  console.table(
    Object.values(records).map((r) => ({ ...r.state, watermark: r.watermark })),
    [...schemas.MatchProjection.keyof().options, "watermark"]
  );
};

let eventId = 0;
const event = <E extends Messages>(
  name: keyof E & string,
  stream: string,
  data: E[keyof E & string]
): CommittedEvent<E> => ({
  id: eventId++,
  stream,
  version: 0,
  created: new Date(),
  name,
  data,
  metadata: { correlation: "", causation: {} }
});

export const steps = [
  {
    event: event("CustomerCreated", customerStream1, {
      id: customerId1,
      name: "Customer 1"
    }),
    state: {
      id: customerStream1,
      customerId: customerId1,
      customerName: "Customer 1"
    }
  },
  {
    event: event("SupplierCreated", supplierStream1, {
      id: supplierId1,
      name: "Supplier 1"
    }),
    state: {
      id: supplierStream1,
      supplierId: supplierId1,
      supplierName: "Supplier 1"
    }
  },
  {
    event: event("JobCreated", jobStream1, {
      id: jobId1,
      title: "Job Title 1",
      customerId: customerId1,
      manager: "Manager 1"
    }),
    state: {
      id: jobStream1,
      jobId: jobId1,
      jobTitle: "Job Title 1",
      customerId: customerId1,
      customerName: "Customer 1",
      manager: "Manager 1"
    }
  },
  {
    event: event("JobCreated", jobStream2, {
      id: jobId2,
      title: "Job Title 2",
      customerId: customerId2,
      manager: "Manager 2"
    }),
    state: {
      id: jobStream2,
      customerId: customerId2,
      jobId: jobId2,
      jobTitle: "Job Title 2",
      manager: "Manager 2"
    }
  },
  {
    event: event("CustomerCreated", customerStream2, {
      id: customerId2,
      name: "Customer 2"
    }),
    state: {
      id: customerStream2,
      customerId: customerId2,
      customerName: "Customer 2"
    }
  },
  {
    event: event("MatchCreated", matchStream1, {
      id: matchId1,
      jobId: jobId1,
      supplierId: supplierId1
    }),
    state: {
      id: matchStream1,
      jobId: jobId1,
      jobTitle: "Job Title 1",
      customerId: customerId1,
      customerName: "Customer 1",
      manager: "Manager 1",
      supplierId: supplierId1,
      supplierName: "Supplier 1"
    }
  },
  {
    event: event("CustomerNameChanged", customerStream1, {
      id: customerId1,
      name: "New customer name for 1"
    }),
    state: {
      id: customerStream1,
      customerId: customerId1,
      customerName: "New customer name for 1"
    }
  },
  {
    event: event("SupplierNameChanged", supplierStream1, {
      id: supplierId1,
      name: "New supplier name for 1"
    }),
    state: {
      id: supplierStream1,
      supplierId: supplierId1,
      supplierName: "New supplier name for 1"
    }
  },
  {
    event: event("JobTitleChanged", jobStream1, {
      id: jobId1,
      title: "New job title for 1"
    }),
    state: {
      id: jobStream1,
      jobId: jobId1,
      jobTitle: "New job title for 1",
      manager: "Manager 1",
      customerId: customerId1,
      customerName: "New customer name for 1"
    }
  },
  {
    event: event("JobManagerChanged", jobStream1, {
      id: jobId1,
      manager: "New manager for 1"
    }),
    state: {
      id: jobStream1,
      jobId: jobId1,
      jobTitle: "New job title for 1",
      manager: "New manager for 1",
      customerId: customerId1,
      customerName: "New customer name for 1"
    }
  },
  {
    event: event("CustomerNameChanged", customerStream2, {
      id: customerId2,
      name: "New customer name for 2"
    }),
    state: {
      id: customerStream2,
      customerId: customerId2,
      customerName: "New customer name for 2"
    }
  }
] as {
  event: CommittedEvent<MatchProjectionEvents>;
  state: Partial<MatchProjection>;
}[];
