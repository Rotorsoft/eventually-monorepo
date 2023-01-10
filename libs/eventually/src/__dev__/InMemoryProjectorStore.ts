import { ProjectorStore } from "../interfaces";
import { ProjectionResponse, State } from "../types";

export const InMemoryProjectorStore = (): ProjectorStore => {
  let _projections: Record<string, ProjectionResponse<State>> = {};

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _projections = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: <S extends State>(id: string): Promise<ProjectionResponse<S>> =>
      Promise.resolve(_projections[id] as ProjectionResponse<S>),

    commit: async <S extends State>(
      id: string,
      state: S,
      expectedWatermark: number,
      newWatermark: number
    ): Promise<ProjectionResponse<S>> => {
      let p = _projections[id] as ProjectionResponse<S>;
      if (p) {
        if (p.watermark !== expectedWatermark) {
          // when another process updates this projection concurrently, the stored watermark should be higher
          if (p.watermark < expectedWatermark)
            throw Error(
              `Projection ${id} stored watermark ${p.watermark} behind expected ${expectedWatermark}`
            );
          // idempotent by default
          return Promise.resolve(p);
        }
        if (newWatermark < p.watermark) {
          throw Error(
            `Projection ${id} new watermark ${newWatermark} behind stored watermark ${p.watermark}`
          );
        }
      }
      p = _projections[id] = { state, watermark: newWatermark };
      return Promise.resolve(p);
    }
  };
};
