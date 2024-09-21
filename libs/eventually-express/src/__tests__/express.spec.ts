import { app, dispose } from "@rotorsoft/eventually";
import { ExpressApp } from "..";
import { HttpClient, config } from "@rotorsoft/eventually-openapi";

const port = 4009;
const http = HttpClient(port);

const expressApp = new ExpressApp();
app(expressApp).withStreams().build();

describe("express app", () => {
  beforeAll(async () => {
    await expressApp.listen(port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should get swagger spec", async () => {
    const swagger = await http.get("/swagger");
    expect(swagger.status).toBe(200);
  });

  it("should get store stats", async () => {
    const stats = await http.get("/_stats");
    expect(stats.status).toBe(200);
  });

  it("should get subscriptions", async () => {
    const stats = await http.get("/_subscriptions");
    expect(stats.status).toBe(200);
  });

  it("should get _health", async () => {
    const swagger = await http.get("/_health");
    expect(swagger.status).toBe(200);
  });

  it("should get home - default", async () => {
    // @ts-expect-error readonly
    config.oas_ui = "SwaggerUI";
    const swagger = await http.get("/");
    expect(swagger.status).toBe(200);
  });

  it("should get home - redoc", async () => {
    // @ts-expect-error readonly
    config.oas_ui = "Redoc";
    const swagger = await http.get("/");
    expect(swagger.status).toBe(200);
  });

  it("should get home - rapidoc", async () => {
    // @ts-expect-error readonly
    config.oas_ui = "Rapidoc";
    const swagger = await http.get("/");
    expect(swagger.status).toBe(200);
  });
});
