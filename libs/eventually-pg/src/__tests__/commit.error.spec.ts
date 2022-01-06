import { Errors, CommittedEvent, Payload, bind } from "@rotorsoft/eventually";
import { Pool, QueryResult } from "pg";
import { PostgresStore } from "../PostgresStore";

const query = (
  sql: string
): Promise<QueryResult<CommittedEvent<string, Payload>>> => {
  if (sql === "COMMIT") {
    return Promise.reject("commit error");
  }
  return Promise.resolve({
    rowCount: 1,
    rows: [
      {
        id: 1,
        name: "test1",
        data: {},
        stream: "stream",
        version: 1,
        created: new Date()
      }
    ],
    command: undefined,
    oid: undefined,
    fields: undefined
  });
};

describe("Mocked", () => {
  const db2 = PostgresStore("db2");

  beforeAll(async () => {
    await db2.init();
  });

  afterAll(async () => {
    await db2.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw concurrecy error when committing", async () => {
    jest.spyOn(Pool.prototype, "connect").mockImplementation(() => ({
      query,
      release: (): void => {
        return;
      }
    }));
    await expect(
      db2.commit("stream", [bind("test", {})], {
        correlation: "",
        causation: {}
      })
    ).rejects.toThrowError(Errors.ConcurrencyError);
  });
});
