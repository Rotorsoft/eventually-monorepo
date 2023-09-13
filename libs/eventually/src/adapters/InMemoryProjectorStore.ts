import type { ProjectorStore } from "../interfaces";
import type {
  Agg,
  AggQuery,
  AggResult,
  Condition,
  Operator,
  Patch,
  Projection,
  ProjectionRecord,
  ProjectionWhere,
  State
} from "../types";
import { conditions, patch } from "../utils";

const filterPredicates: Record<Operator, (a: any, b: any) => boolean> = {
  eq: (a, b) => a == b,
  neq: (a, b) => a != b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  in: (a, b) => a == b,
  nin: (a, b) => a != b
};

/**
 * @category Adapters
 * @remarks In-memory projector store
 */
export const InMemoryProjectorStore = <
  S extends State
>(): ProjectorStore<S> => {
  let _records: Record<string, ProjectionRecord<S>> = {};

  // filters record following where clause
  const _filter = (
    record: ProjectionRecord<S>,
    where: ProjectionWhere<S>
  ): boolean => {
    for (const [key, condition] of Object.entries(where)) {
      const recval = record.state[key]!;
      for (const [operator, value] of conditions(condition as Condition<any>)) {
        if (!filterPredicates[operator](recval, value)) return false;
      }
    }
    return true;
  };

  // upserts records after watermark
  const _upsert = (id: string, _patch: Patch<S>, watermark: number): 0 | 1 => {
    // insert
    if (!_records[id]) {
      _records[id] = {
        // TODO: handle default values
        state: { id, ..._patch } as unknown as Projection<S>,
        watermark
      };
      return 1;
    }
    // update
    if (_records[id].watermark < watermark) {
      _records[id] = {
        state: { id, ...patch(_records[id].state, _patch) } as Projection<S>,
        watermark
      };
      return 1;
    }
    // out of sync
    return 0;
  };

  // deletes records after watermark
  const _delete = (id: string, watermark: number): 0 | 1 => {
    if (_records[id] && _records[id].watermark < watermark) {
      delete _records[id];
      return 1;
    }
    return 0;
  };

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _records = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    drop: () => {
      _records = {};
      return Promise.resolve();
    },

    load: (ids) =>
      Promise.resolve(ids.map((id) => _records[id]).filter(Boolean)),

    commit: async (map, watermark) => {
      let upserted = 0,
        deleted = 0;

      // filtered deletes
      map.deletes.forEach((del) => {
        const recs = Object.values(_records).filter((rec) => _filter(rec, del));
        recs.forEach((rec) => (deleted += _delete(rec.state.id, watermark)));
      });

      // filtered updates
      map.updates.forEach(({ where, ...patch }) => {
        if (where) {
          const recs = Object.values(_records).filter((rec) =>
            _filter(rec, where)
          );
          recs.forEach(
            (rec) =>
              (upserted += _upsert(rec.state.id, patch as Patch<S>, watermark))
          );
        }
      });

      // patched records
      map.records.forEach((rec, id) => {
        // upserts when multiple keys are found in patch
        if (Object.keys(rec).length) upserted += _upsert(id, rec, watermark);
        else deleted += _delete(id, watermark);
      });

      return Promise.resolve({ upserted, deleted, watermark });
    },

    query: (query) => {
      const result: ProjectionRecord<S>[] = [];
      for (const record of Object.values(_records)) {
        const match = query.where ? _filter(record, query.where) : true;
        if (match) {
          result.push(record);
          if (query.limit && result.length > query.limit) break;
        }
      }
      // TODO: apply sort and select clauses
      return Promise.resolve(result);
    },

    agg: (query: AggQuery<S>) => {
      const keys = Object.entries(query.select) as Array<[string, Agg[]]>;
      const sum = new Array<number>(keys.length).fill(0);
      const min = new Array<number>(keys.length);
      const max = new Array<number>(keys.length);
      const cnt = new Array<number>(keys.length).fill(0);
      for (const record of Object.values(_records)) {
        const match = query.where ? _filter(record, query.where) : true;
        if (match) {
          keys.forEach((key, index) => {
            const val = record.state[key[0]] as number | undefined | null;
            if (val) {
              cnt[index]++;
              sum[index] += val;
              min[index] = Math.min(min[index] ?? val, val);
              max[index] = Math.max(max[index] ?? val, val);
            }
          });
        }
      }
      return Promise.resolve(
        keys.reduce((result, key, index) => {
          key[1].forEach((agg) => {
            const value =
              agg === "count"
                ? cnt[index]
                : agg === "sum"
                ? sum[index]
                : agg === "min"
                ? min[index]
                : agg === "max"
                ? max[index]
                : cnt[index]
                ? sum[index] / cnt[index]
                : null;
            result = patch(result, { [key[0]]: { [agg]: value } });
          });
          return result;
        }, {}) as AggResult<S>
      );
    }
  };
};
