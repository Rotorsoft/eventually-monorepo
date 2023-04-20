import { dispose, store } from "@rotorsoft/eventually";
import { getConflicts } from "@rotorsoft/eventually-openapi";
import axios from "axios";
import { getEventContract, refreshServiceSpec } from "../specs";
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
    const contract = getEventContract("ProfileUpdated");
    expect(contract).toBeDefined();
    getConflicts(contract);
  });
});
