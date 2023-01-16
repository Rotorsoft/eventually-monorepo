import { ProjectionRecord, ProjectorStore } from "../interfaces";
import { CommittedProjection, Projection, ProjectionState } from "../types";

export const InMemoryProjectorStore = (): ProjectorStore => {
  let _projections: Record<string, ProjectionRecord> = {};

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _projections = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: <S extends ProjectionState>(
      id: string
    ): Promise<ProjectionRecord<S> | undefined> =>
      Promise.resolve(_projections[id] as ProjectionRecord<S>),

    commit: async <S extends ProjectionState>(
      projection: Projection<S>,
      watermark: number
    ): Promise<CommittedProjection<S>> => {
      const id = projection.filter.id;
      id &&
        !_projections[id] &&
        (_projections[id] = {
          state: { id, ...projection.values },
          watermark: -1
        });

      const filter = Object.entries(projection.filter)
        .map(([k, v]) => `${k}=${v}`)
        .join(";");
      const match = Object.values(_projections).filter(
        (p) =>
          p.watermark < watermark &&
          filter ===
            Object.entries(p.state)
              .filter(([k]) => projection.filter[k])
              .map(([k, v]) => `${k}=${v}`)
              .join(";")
      );
      match.forEach(
        (p) =>
          (_projections[p.state.id] = {
            state: Object.assign(p.state, projection.values),
            watermark
          })
      );
      return Promise.resolve({
        projection,
        records: match.length,
        watermark
      });
    }
  };
};
