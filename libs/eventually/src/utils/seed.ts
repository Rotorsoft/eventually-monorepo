import { app, store, subscriptions } from "../ports";

/**
 * Seeds all registered stores
 */
export const seed = async (): Promise<void> => {
  await store().seed();
  await subscriptions().seed();
  for (const [, artifact] of app().artifacts) {
    if (artifact.type === "projector" && artifact.projector)
      await artifact.projector.store.seed(
        artifact.projector.schema,
        artifact.projector.indexes
      );
  }
};
