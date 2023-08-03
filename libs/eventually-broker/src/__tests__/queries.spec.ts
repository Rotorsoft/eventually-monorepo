import axios from "axios";
import { dispose } from "@andela-technology/eventually";
import { getServiceStream } from "../queries";
import { serviceBody } from "./utils";

const service = serviceBody("s");
service.allPath = "/all";

describe("queries", () => {
  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should get queries", async () => {
    jest.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: []
    });

    const data = await getServiceStream(service, {});
    expect(data).toBeDefined();
  });
});
