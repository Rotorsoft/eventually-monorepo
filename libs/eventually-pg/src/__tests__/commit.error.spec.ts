import {
  Errors,
  CommittedEvent,
  Payload,
  bind,
  dispose
} from "@rotorsoft/eventually";
import { Pool, QueryResult } from "pg";
import { PostgresStore } from "../PostgresStore";

const db = PostgresStore("commit_error_test");

const query = (
  sql: string
): Promise<QueryResult<CommittedEvent<string, Payload>>> => {
  const commit = sql.indexOf("COMMIT");
  if (commit > 0) return Promise.reject("mocked commit error");

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
  beforeAll(async () => {
    await db.seed();
  });

  afterAll(async () => {
    await dispose()();
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
      db.commit("stream", [bind("test", {})], {
        correlation: "",
        causation: {}
      })
    ).rejects.toThrowError(Errors.ConcurrencyError);
  });
});
