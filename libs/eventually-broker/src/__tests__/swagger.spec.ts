import { dispose, store } from "@rotorsoft/eventually";
import axios from "axios";
import { getConflicts, refreshServiceSpec } from "../specs";
import { swagger } from "./swagger.doc";
import { serviceBody } from "./utils";

jest
  .spyOn(axios, "get")
  .mockResolvedValue({ status: 200, statusText: "OK", data: swagger });

describe("channels", () => {
  beforeAll(async () => {
    await store().seed();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should get specs", async () => {
    const service1 = serviceBody("test1");
    const service2 = serviceBody("test2");
    await refreshServiceSpec(service1);
    await refreshServiceSpec(service2);
    expect(service1.schemas).toBeDefined();
    expect(service2.schemas).toBeDefined();
    service1.schemas &&
      service2.schemas &&
      getConflicts([
        ...Object.values(service1.schemas),
        ...Object.values(service2.schemas)
      ]);
  });
});
