import {
  app,
  ArtifactFactory,
  bootstrap,
  log,
  store
} from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { config } from "./config";

/**
 * Generic service boot
 */
export const boot = (): Promise<void> =>
  bootstrap(async (): Promise<void> => {
    const _app = app(new ExpressApp());
    const { eventually } = config;

    if (eventually.store) {
      store(PostgresStore(eventually.store));
    }

    if (eventually.artifacts) {
      await Promise.all(
        Object.entries(eventually.artifacts).map(
          async ([packname, artifacts]) => {
            try {
              const pkg = await import(packname);
              artifacts.forEach((artifact) =>
                _app.with(pkg[artifact.name] as ArtifactFactory, {
                  scope: artifact.scope
                })
              );
            } catch (error) {
              log().error(error);
            }
          }
        )
      );
    }

    _app.build();
    await _app.listen();
  });

require.main === module && void boot();
