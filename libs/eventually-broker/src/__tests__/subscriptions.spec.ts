import { config } from "@rotorsoft/eventually-pg";
import { Pool } from "pg";
import { PostgresSubscriptionStore } from "..";

const seed = `
delete from public.subscriptions;
delete from public.services;
insert into public.services(id, channel, url) values('calculator', 'pg://calculator', 'http://localhost:3000');
insert into public.subscriptions(id, producer, consumer, path, streams, names) values('id1', 'calculator', 'calculator', 'counter', '^Calculator-.+$', '.*');	
insert into public.subscriptions(id, producer, consumer, path, streams, names) values('id2', 'calculator', 'calculator', 'counter', '^Calculator-.+$', '.*');	
`;

const db = PostgresSubscriptionStore();
const pool = new Pool(config.pg);

describe("subscriptions", () => {
  beforeAll(async () => {
    await db.init(true);
    await db.init();
    await pool.query(seed);
  });

  afterAll(async () => {
    await db.close();
    await db.close();
    await pool.end();
  });

  it("should load subscriptions", async () => {
    const result = await db.loadSubscriptions();
    expect(result.length).toBe(2);
  });

  it("should load subscription", async () => {
    const result = await db.loadSubscriptions("id2");
    expect(result.length).toBe(1);
  });

  it("should commit position", async () => {
    await db.commitPosition("id1", 10);
    await db.commitPosition("id2", 10);
    const result = await db.loadSubscriptions();
    expect(result.length).toBe(2);
    expect(result[0].position).toBe(10);
    expect(result[1].position).toBe(10);
  });
});
