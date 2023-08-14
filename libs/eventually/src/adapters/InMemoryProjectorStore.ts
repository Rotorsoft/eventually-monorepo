import type { ProjectorStore } from "../interfaces";
import type {
  Condition,
  Operator,
  Projection,
  ProjectionRecord,
  State
} from "../types";
import { patchCopy } from "../utils";

/**
 * @category Adapters
 * @remarks In-memory projector store
 */
export const InMemoryProjectorStore = <
  S extends State
>(): ProjectorStore<S> => {
  let _records: Record<string, ProjectionRecord<S>> = {};

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _records = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: (ids) =>
      Promise.resolve(ids.map((id) => _records[id]).filter(Boolean)),

    commit: async (map, watermark) => {
      let upserted = 0,
        deleted = 0;

      map.forEach((patch) => {
        // upsert when multiple keys are found in state (id + values)
        if (Object.keys(patch).length > 1 && patch.id) {
          if (!_records[patch.id]) {
            _records[patch.id] = {
              state: { ...patch } as unknown as Projection<S>,
              watermark
            };
            upserted++;
          } else if (_records[patch.id].watermark < watermark) {
            _records[patch.id] = {
              state: patchCopy<Projection<S>>(_records[patch.id].state, patch),
              watermark
            };
            upserted++;
          }
        } else if (patch.id) {
          if (_records[patch.id] && _records[patch.id].watermark < watermark) {
            delete _records[patch.id];
            deleted++;
          }
        }
      });

      return Promise.resolve({ upserted, deleted, watermark });
    },

    query: (query) => {
      const result: ProjectionRecord<S>[] = [];
      for (const record of Object.values(_records)) {
        // TODO: apply sort and select clauses
        const match = query.where
          ? Object.entries(query.where).reduce(
              (match, [key, condition]: [string, Condition<any>]) => {
                const { operator, value }: { operator: Operator; value: any } =
                  typeof condition === "object" && "operator" in condition
                    ? condition
                    : { operator: "eq", value: condition };
                const val = record.state[key]!;
                switch (operator) {
                  case "eq":
                    return match && val == value;
                  case "neq":
                    return match && val != value;
                  case "lt":
                    return match && val < value;
                  case "lte":
                    return match && val <= value;
                  case "gt":
                    return match && val > value;
                  case "gte":
                    return match && val >= value;
                  case "in":
                    return match && val == value;
                  case "nin":
                    return match && val != value;
                }
              },
              true
            )
          : true;
        if (match) {
          result.push(record);
          if (query.limit && result.length > query.limit) break;
        }
      }
      return Promise.resolve(result);
    }
  };
};
