import {
  AggregateFactory,
  app,
  bootstrap,
  CommandAdapterFactory,
  ExternalSystemFactory,
  log,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
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
      await store().seed();
    }

    if (eventually.aggregates) {
      await Promise.all(
        Object.entries(eventually.aggregates).map(async ([k, v]) => {
          try {
            const pkg = await import(v.package);
            const factory = pkg[k] as AggregateFactory<Payload, any, any>;
            _app.withAggregate(factory, v.description);
          } catch (error) {
            log().error(error);
          }
        })
      );
    }

    if (eventually.policies) {
      await Promise.all(
        Object.entries(eventually.policies).map(async ([k, v]) => {
          try {
            const pkg = await import(v.package);
            const factory = pkg[k] as PolicyFactory<any, any>;
            _app.withPolicy(factory, v.description);
          } catch (error) {
            log().error(error);
          }
        })
      );
    }

    if (eventually.adapters) {
      await Promise.all(
        Object.entries(eventually.adapters).map(async ([k, v]) => {
          try {
            const pkg = await import(v.package);
            const factory = pkg[k] as CommandAdapterFactory<any, any>;
            _app.withCommandAdapter(factory);
          } catch (error) {
            log().error(error);
          }
        })
      );
    }

    if (eventually["external-systems"]) {
      await Promise.all(
        Object.entries(eventually["external-systems"]).map(async ([k, v]) => {
          try {
            const pkg = await import(v.package);
            const factory = pkg[k] as ExternalSystemFactory<any, any>;
            _app.withExternalSystem(factory, v.description);
          } catch (error) {
            log().error(error);
          }
        })
      );
    }

    if (eventually["process-managers"]) {
      await Promise.all(
        Object.entries(eventually["process-managers"]).map(async ([k, v]) => {
          try {
            const pkg = await import(v.package);
            const factory = pkg[k] as ProcessManagerFactory<Payload, any, any>;
            _app.withProcessManager(factory, v.description);
          } catch (error) {
            log().error(error);
          }
        })
      );
    }

    _app.build();
    await _app.listen();
  });

require.main === module && void boot();
