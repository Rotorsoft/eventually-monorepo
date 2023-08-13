import type { ProjectorStore } from "../interfaces";
import type { Condition, Projection, ProjectionRecord, State } from "../types";
import { clone } from "../utils";

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
              state: clone<Projection<S>>(_records[patch.id].state, patch),
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
                const val = record.state[key]!;
                switch (condition.operator) {
                  case "eq":
                    return match && val == condition.value;
                  case "neq":
                    return match && val != condition.value;
                  case "lt":
                    return match && val < condition.value;
                  case "lte":
                    return match && val <= condition.value;
                  case "gt":
                    return match && val > condition.value;
                  case "gte":
                    return match && val >= condition.value;
                  case "in":
                    return match && val == condition.value;
                  case "nin":
                    return match && val != condition.value;
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
