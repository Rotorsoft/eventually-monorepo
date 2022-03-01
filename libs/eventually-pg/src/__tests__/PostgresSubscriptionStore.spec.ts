import { Pool } from "pg";
import { PostgresSubscriptionStore, config } from "..";

const table = "subscriptions_test";
const seed = `
insert into ${table}(id, channel, streams, names, endpoint) values('id1', 'calculator', '^Calculator-.+$', '.*', 'http://localhost:3000/counter');	
insert into ${table}(id, channel, streams, names, endpoint) values('id2', 'calculator', '^Calculator-.+$', '.*', 'http://localhost:3000/counter');	
`;

const db = PostgresSubscriptionStore(table);

describe("PostgresSubscriptionStore", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool(config.pg);
    await pool.query(`DROP TABLE IF EXISTS ${table};`);
    await db.init();
    await db.init();
    await pool.query(seed);
  });

  afterAll(async () => {
    await pool.end();
    await db.close();
    await db.close();
  });

  it("should load subscriptions", async () => {
    const result = await db.load();
    expect(result.length).toBe(2);
  });

  it("should commit position", async () => {
    await db.commit("id1", 10);
    await db.commit("id2", 10);
    const result = await db.load();
    expect(result.length).toBe(2);
    expect(result[0].position).toBe(10);
    expect(result[1].position).toBe(10);
  });
});
