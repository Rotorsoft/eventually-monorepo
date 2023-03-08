import deepmerge from "deepmerge";
import { ProjectorStore } from "../interfaces";
import {
  ProjectionResults,
  Projection,
  ProjectionRecord,
  ProjectionState,
  ProjectionQuery,
  Condition,
  Operator
} from "../types";

// default deepmerge options: arrays are replaced
const defaultOptions: deepmerge.Options = {
  arrayMerge: (target, source) => source
};

/**
 * @category Adapters
 * @remarks In-memory projector store
 */
export const InMemoryProjectorStore = (
  options = defaultOptions
): ProjectorStore => {
  let _projections: Record<string, ProjectionRecord> = {};

  const select = <S extends ProjectionState>(
    watermark: number,
    filter?: Partial<S>
  ): ProjectionRecord<S>[] => {
    const key = filter
      ? Object.entries(filter)
          .map(([k, v]) => `${k}=${v}`)
          .join(";")
      : undefined;
    return (
      filter
        ? Object.values(_projections).filter(
            (p) =>
              p.watermark < watermark &&
              key ===
                Object.entries(p.state)
                  .filter(([k]) => filter[k])
                  .map(([k, v]) => `${k}=${v}`)
                  .join(";")
          )
        : []
    ) as ProjectionRecord<S>[];
  };

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _projections = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: <S extends ProjectionState>(
      ids: string[]
    ): Promise<ProjectionRecord<S>[]> =>
      Promise.resolve(
        ids.map((id) => _projections[id] as ProjectionRecord<S>).filter(Boolean)
      ),

    commit: async <S extends ProjectionState>(
      projection: Projection<S>,
      watermark: number
    ): Promise<ProjectionResults<S>> => {
      const results: ProjectionResults<S> = {
        projection,
        upserted: 0,
        deleted: 0,
        watermark
      };

      projection.upserts &&
        projection.upserts.forEach(({ where, values }) => {
          const id = where.id;
          id &&
            !_projections[id] &&
            (_projections[id] = {
              state: { id, ...values },
              watermark: -1
            });

          const to_upsert = select(watermark, where);
          to_upsert.forEach(
            (p) =>
              (_projections[p.state.id] = {
                state: deepmerge(p.state, values as Partial<S>, options),
                watermark
              })
          );
          results.upserted += to_upsert.length;
        });

      projection.deletes &&
        projection.deletes.forEach(({ where }) => {
          const to_delete = select(watermark, where).map((p) => p.state.id);
          to_delete.forEach((id) => delete _projections[id]);
          results.deleted += to_delete.length;
        });

      return Promise.resolve(results);
    },

    query: <S extends ProjectionState>(
      query: ProjectionQuery<S>,
      callback: (record: ProjectionRecord<S>) => void
    ): Promise<number> => {
      let count = 0;
      Object.values(_projections).forEach((record) => {
        // TODO: apply sort and select clauses
        const match = query.where
          ? Object.entries(query.where).reduce(
              (match, [key, condition]: [string, Condition<any>]) => {
                switch (condition.operator) {
                  case Operator.eq:
                    return match && record.state[key] == condition.value;
                  case Operator.neq:
                    return match && record.state[key] != condition.value;
                  case Operator.lt:
                    return match && record.state[key] < condition.value;
                  case Operator.lte:
                    return match && record.state[key] <= condition.value;
                  case Operator.gt:
                    return match && record.state[key] > condition.value;
                  case Operator.gte:
                    return match && record.state[key] >= condition.value;
                  case Operator.in:
                    return match && record.state[key] == condition.value;
                  case Operator.not_in:
                    return match && record.state[key] != condition.value;
                }
              },
              true
            )
          : true;
        if (match) {
          count++;
          if (query.limit && count > query.limit) return count;
          callback(record as ProjectionRecord<S>);
        }
      });
      return Promise.resolve(count);
    }
  };
};
