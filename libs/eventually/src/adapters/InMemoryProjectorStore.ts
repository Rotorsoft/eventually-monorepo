import deepmerge from "deepmerge";
import { ProjectorStore } from "../interfaces";
import {
  ProjectionResults,
  Projection,
  ProjectionRecord,
  ProjectionQuery,
  Condition,
  Operator,
  State,
  StateWithId
} from "../types";

// default deepmerge options: arrays are replaced
const defaultOptions: deepmerge.Options = {
  arrayMerge: (target, source) => source
};

/**
 * @category Adapters
 * @remarks In-memory projector store
 */
export const InMemoryProjectorStore = <S extends State>(
  options = defaultOptions
): ProjectorStore<S> => {
  let _projections: Record<string, ProjectionRecord<S>> = {};

  const select = (
    watermark: number,
    filter?: Partial<S>
  ): ProjectionRecord<S>[] => {
    const key = filter
      ? Object.entries(filter)
          .map(([k, v]) => `${k}=${v}`)
          .join(";")
      : undefined;
    return filter
      ? Object.values(_projections).filter(
          (p) =>
            p.watermark < watermark &&
            key ===
              Object.entries(p.state)
                .filter(([k]) => filter[k])
                .map(([k, v]) => `${k}=${v}`)
                .join(";")
        )
      : [];
  };

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _projections = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: (ids: string[]): Promise<ProjectionRecord<S>[]> =>
      Promise.resolve(ids.map((id) => _projections[id]).filter(Boolean)),

    commit: async (
      projection: Projection<S>,
      watermark: number
    ): Promise<ProjectionResults<S>> => {
      let upserted = 0,
        deleted = 0;

      projection.upserts &&
        projection.upserts.forEach(({ where, values }) => {
          const id = where.id;
          id &&
            !_projections[id] &&
            (_projections[id] = {
              state: { id, ...values } as unknown as StateWithId<S>,
              watermark: -1
            });

          const to_upsert = select(watermark, where);
          to_upsert.forEach(
            (p) =>
              (_projections[p.state.id] = {
                state: deepmerge<StateWithId<S>>(p.state, values, options),
                watermark
              })
          );
          upserted += to_upsert.length;
        });

      projection.deletes &&
        projection.deletes.forEach(({ where }) => {
          const to_delete = select(watermark, where).map((p) => p.state.id);
          to_delete.forEach((id) => delete _projections[id]);
          deleted += to_delete.length;
        });

      return Promise.resolve({ projection, upserted, deleted, watermark });
    },

    query: (
      query: ProjectionQuery<S>,
      callback: (record: ProjectionRecord<S>) => void
    ): Promise<number> => {
      let count = 0;
      Object.values(_projections).forEach((record) => {
        // TODO: apply sort and select clauses
        const match = query.where
          ? Object.entries(query.where).reduce(
              (match, [key, condition]: [string, Condition<any>]) => {
                const val = record.state[key];
                switch (condition.operator) {
                  case Operator.eq:
                    return match && val == condition.value;
                  case Operator.neq:
                    return match && val != condition.value;
                  case Operator.lt:
                    return match && val < condition.value;
                  case Operator.lte:
                    return match && val <= condition.value;
                  case Operator.gt:
                    return match && val > condition.value;
                  case Operator.gte:
                    return match && val >= condition.value;
                  case Operator.in:
                    return match && val == condition.value;
                  case Operator.not_in:
                    return match && val != condition.value;
                }
              },
              true
            )
          : true;
        if (match) {
          count++;
          if (query.limit && count > query.limit) return count;
          callback(record);
        }
      });
      return Promise.resolve(count);
    }
  };
};
