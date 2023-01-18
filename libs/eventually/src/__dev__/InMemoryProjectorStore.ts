import deepmerge from "deepmerge";
import { ProjectionRecord, ProjectorStore } from "../interfaces";
import { ProjectionResults, Projection, ProjectionState } from "../types";

export const InMemoryProjectorStore = (): ProjectorStore => {
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
    ): Promise<Record<string, ProjectionRecord<S>>> =>
      Promise.resolve(
        ids
          .map((id) => _projections[id])
          .filter(Boolean)
          .reduce((p, c) => {
            p[c.state.id] = c as ProjectionRecord<S>;
            return p;
          }, {} as Record<string, ProjectionRecord<S>>)
      ),

    commit: async <S extends ProjectionState>(
      projection: Projection<S>,
      watermark: number
    ): Promise<ProjectionResults<S>> => {
      const [upsert_filter, upsert_values] = projection.upsert || [
        undefined,
        undefined
      ];
      const id = upsert_filter && upsert_filter.id;
      id &&
        !_projections[id] &&
        (_projections[id] = {
          state: { id, ...upsert_values },
          watermark: -1
        });

      const to_upsert = select(watermark, upsert_filter);
      to_upsert.forEach(
        (p) =>
          (_projections[p.state.id] = {
            state: deepmerge(p.state, upsert_values as Partial<S>),
            watermark
          })
      );

      const to_delete = select(watermark, projection.delete).map(
        (p) => p.state.id
      );
      to_delete.forEach((id) => delete _projections[id]);

      return Promise.resolve({
        projection,
        upserted: to_upsert.length,
        deleted: to_delete.length,
        watermark
      });
    }
  };
};
