import {
  Errors,
  CommittedEvent,
  bind,
  dispose,
  Message,
  Payload
} from "@andela-technology/eventually";
import { Pool, QueryResult } from "pg";
import { PostgresStore } from "../PostgresStore";

const db = PostgresStore("commit_error_test");

const query = (sql: string): Promise<QueryResult<CommittedEvent>> => {
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
  } as any);
};

describe("Mocked", () => {
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
      db.commit("stream", [bind<{ test: Payload }>("test", {}) as Message], {
        correlation: "",
        causation: {}
      })
    ).rejects.toThrowError(Errors.ConcurrencyError);
  });
});
