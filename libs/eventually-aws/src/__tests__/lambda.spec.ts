import { app, broker, dispose } from "@rotorsoft/eventually";
import { Calculator, CalculatorTotals } from "@rotorsoft/calculator-artifacts";
import { command, query } from "../lambda";
import { proxyEvent } from "./proxyEvent";

describe("lambda", () => {
  beforeAll(() => {
    app().with(Calculator).with(CalculatorTotals).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should invoke command", async () => {
    const result = await command(
      proxyEvent(
        "POST",
        "/calculator/calc-123/press-key",
        JSON.stringify({ key: "1" }),
        { "if-match": "-1" }
      )
    );
    expect(JSON.parse(result.body)).toHaveProperty("result");
  });

  it("should fail path", async () => {
    const result = await command(
      proxyEvent("POST", "/calcul/press-key", JSON.stringify({ key: "1" }))
    );
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "Invalid path. Use: /system-name/stream/command-name",
        details: {
          path: "/calcul/press-key"
        }
      }
    });
  });

  it("should fail system", async () => {
    const result = await command(
      proxyEvent("POST", "/calcul/1/press-key", JSON.stringify({ key: "1" }))
    );
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "System not found",
        details: { parsedPath: "/Calcul/1/PressKey", system: "Calcul" }
      }
    });
  });

  it("should fail system type", async () => {
    const result = await command(
      proxyEvent(
        "POST",
        "/calculator-totals/1/press-key",
        JSON.stringify({ key: "1" })
      )
    );
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "Invalid system",
        details: {
          type: "projector",
          parsedPath: "/CalculatorTotals/1/PressKey",
          system: "CalculatorTotals"
        }
      }
    });
  });

  it("should fail command", async () => {
    const result = await command(
      proxyEvent("POST", "/calculator/1/preskey", JSON.stringify({ key: "1" }))
    );
    expect(JSON.parse(result.body)).toEqual({
      error: { message: 'Message "Preskey" not registered with app builder!' }
    });
  });

  it("should invoke query", async () => {
    await command(
      proxyEvent(
        "POST",
        "/calculator/1/press-key",
        JSON.stringify({ key: "1" })
      )
    );
    await command(
      proxyEvent(
        "POST",
        "/calculator/1/press-key",
        JSON.stringify({ key: "2" })
      )
    );
    await command(
      proxyEvent(
        "POST",
        "/calculator/1/press-key",
        JSON.stringify({ key: "2" })
      )
    );
    await broker().drain();
    const result = await query(
      proxyEvent(
        "GET",
        "/calculator-totals",
        null,
        {},
        {
          queryStringParameters: {
            sort: "t1 asc",
            limit: "10"
          },
          multiValueQueryStringParameters: {
            select: ["id", "t1", "t2"],
            where: ["t1 gt 0", "t2 gt 1"]
          }
        }
      )
    );
    expect(JSON.parse(result.body).result).toEqual([
      { state: { id: "Totals-1", t1: 1, t2: 2 }, watermark: 3 }
    ]);
  });

  it("should fail query", async () => {
    const result = await query(
      proxyEvent("GET", "/calculator-totals/and-something-else")
    );
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "Invalid path. Use: /projector-name",
        details: {
          path: "/calculator-totals/and-something-else"
        }
      }
    });
  });

  it("should fail projector", async () => {
    const result = await query(proxyEvent("GET", "/calculatortotals"));
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "Projector not found",
        details: {
          projector: "Calculatortotals"
        }
      }
    });
  });

  it("should fail projector type", async () => {
    const result = await query(proxyEvent("GET", "/calculator"));
    expect(JSON.parse(result.body)).toEqual({
      error: {
        message: "Invalid projector",
        details: {
          type: "aggregate",
          projector: "Calculator"
        }
      }
    });
  });

  it("should fail query where", async () => {
    const result = await query(
      proxyEvent(
        "GET",
        "/calculator-totals",
        null,
        {},
        {
          queryStringParameters: { where: "b" },
          multiValueQueryStringParameters: {}
        }
      )
    );
    expect(JSON.parse(result.body).error.message).toEqual(
      "Invalid where clause: b"
    );
  });

  it("should fail query select", async () => {
    const result = await query(
      proxyEvent(
        "GET",
        "/calculator-totals",
        null,
        {},
        {
          queryStringParameters: {},
          multiValueQueryStringParameters: { select: ["a"] }
        }
      )
    );
    expect(JSON.parse(result.body).error.message).toEqual(
      " failed validation [select.0: Invalid enum value. Expected 'id' | 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 't8' | 't9', received 'a']"
    );
  });

  it("should fail query sort", async () => {
    const result = await query(
      proxyEvent(
        "GET",
        "/calculator-totals",
        null,
        {},
        {
          queryStringParameters: { sort: "id" },
          multiValueQueryStringParameters: {}
        }
      )
    );
    expect(JSON.parse(result.body).error.message).toEqual(
      "Invalid sort clause: id"
    );
  });
});
