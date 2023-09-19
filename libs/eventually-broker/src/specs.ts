import { breaker, log } from "@rotorsoft/eventually";
import {
  EventContract,
  OpenAPIObject,
  getConflicts,
  getServiceSpec
} from "@rotorsoft/eventually-openapi";
import * as axios from "axios";
import { state } from "./cluster";
import { Service } from "./types";

const consumers: Record<string, Service> = {};
const events: Record<string, EventContract> = {};

export const getEventContract = (name: string): EventContract => events[name];

const refreshServiceEventContracts = (service: Service): void => {
  const found = Object.entries(consumers).filter(
    ([, v]) => v.id === service.id
  );
  found.forEach(([path]) => delete consumers[path]);

  service.eventHandlers &&
    Object.values(service.eventHandlers).forEach(
      (handler) => (consumers[handler.path] = service)
    );

  service.schemas &&
    Object.values(service.schemas).forEach((schema) => {
      const event = (events[schema.name] = events[schema.name] || {
        name: schema.name,
        schema,
        producers: {},
        consumers: {}
      });
      if (schema.refs && schema.refs.length) {
        schema.refs.forEach((ref) => {
          const consumer = consumers[ref];
          event.consumers[service.id] = {
            id: consumer && consumer.id,
            path: ref,
            schema
          };
        });
        if (schema.inSnapshot) event.producers[service.id] = service.id;
      } else {
        event.producers[service.id] = service.id;
        event.schema = schema;
      }
      event.conflicts = getConflicts(event);
    });
};

export const getEventContracts = (): EventContract[] => {
  return Object.values(events).sort((a, b) =>
    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
  );
};

const HTTP_TIMEOUT = 5000;

/**
 * Refreshes OpenAPI specs of a service to keep version and contracts updated
 * @param service the service
 */
export const refreshServiceSpec = async (service: Service): Promise<void> => {
  !service.breaker &&
    (service.breaker = breaker(service.id, {
      timeout: 60000,
      failureThreshold: 2,
      successThreshold: 2
    }));
  const response = await service.breaker.exec<OpenAPIObject>(async () => {
    try {
      const url = new URL(service.url);
      if (!url.protocol.startsWith("http"))
        return { error: `Invalid protocol ${url.protocol}` };
      const secretsQueryString = state().serviceSecretsQueryString(service.id);
      const path = `${service.url.replace(
        /\/+$/,
        ""
      )}/swagger${secretsQueryString}`;
      const response = await axios.default.get<OpenAPIObject>(path, {
        timeout: HTTP_TIMEOUT
      });
      return { data: response.data };
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        err.code === "ENOTFOUND" && service.breaker && service.breaker.pause();
        return { error: err.message };
      }
      return { error: "Oops! We don't have details!" };
    }
  });
  if (response.data) {
    response.data.info && Object.assign(service, getServiceSpec(response.data));
    refreshServiceEventContracts(service);
  } else if (response.error) {
    log().info(`Refresh ${service.url}/swagger`, response.error);
  }
};
