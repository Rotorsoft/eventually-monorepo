import {
  Calculator,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import { app, dispose } from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";

const port = 4009;
const http = HttpClient(port);

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator)
  .with(StatelessCounter)
  .with(PressKeyAdapter)
  .build();

describe("calculator swagger express app", () => {
  beforeAll(async () => {
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should get swagger spec", async () => {
    const swagger = await http.get("/swagger");
    expect(swagger.status).toBe(200);
  });

  it("should get store stats", async () => {
    const stats = await http.get("/stats");
    expect(stats.status).toBe(200);
  });

  it("should get redoc spec", async () => {
    const swagger = await http.get("/_redoc");
    expect(swagger.status).toBe(200);
  });

  it("should get _health", async () => {
    const swagger = await http.get("/_health");
    expect(swagger.status).toBe(200);
  });

  it("should get _config", async () => {
    const swagger = await http.get("/_config");
    expect(swagger.status).toBe(200);
  });

  it("should get home", async () => {
    const swagger = await http.get("/");
    expect(swagger.status).toBe(200);
  });
});
