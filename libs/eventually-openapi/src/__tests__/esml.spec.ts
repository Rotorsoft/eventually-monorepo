import { z } from "zod";
import { esml, toSchema } from "../home/esml";
import { InferAggregate, app } from "@rotorsoft/eventually";

const Child = z.object({
  id: z.string()
});

const AggState = z.object({
  name: z.string(),
  child: Child,
  children: z.record(Child).optional()
});

const AggSchemas = {
  state: AggState,
  commands: {
    One: z.object({})
  },
  events: {}
};

const Agg = (stream: string): InferAggregate<typeof AggSchemas> => ({
  stream,
  description: "",
  schemas: AggSchemas,
  init: () => ({ name: "", child: { id: "" } }),
  reduce: {},
  on: { One: () => Promise.resolve([]) }
});

describe("esml", () => {
  it("should parse full schema", () => {
    const results = toSchema(AggState, {});
    expect(results).toEqual({
      requires: { name: "string", child: "Xchild0" },
      optional: { children: "Xchildren1" }
    });
  });

  it("should parse app", () => {
    app().with(Agg).build();
    const results = esml();
    expect(results).toEqual({
      EventuallyMonorepo: {
        Agg: {
          type: "aggregate",
          handles: ["One"],
          schema: {
            requires: { name: "string", child: "Xchild1" },
            optional: { children: "Xchildren2" }
          }
        },
        Xchild1: { type: "schema", requires: { id: "string" } },
        Xchildren2: { type: "schema", requires: { id: "string" } }
      }
    });
  });
});
