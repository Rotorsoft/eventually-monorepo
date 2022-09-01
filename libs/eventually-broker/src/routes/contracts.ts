import { Request, Response, Router } from "express";
import { AllQuery, ExtendedSchemaObject, Service } from "..";
import { state } from "../cluster";
import { getConflicts } from "../specs";
import { ensureArray } from "../utils";

export const router = Router();

type ServiceContracts = { events: ExtendedSchemaObject[] };
const getServiceContracts = (
  services: Service[],
  names?: string[]
): Record<string, ServiceContracts> => {
  return Object.assign(
    {},
    ...services
      .filter((service) => service.schemas)
      .map((service) => ({
        [service.id]: {
          events: Object.values(service.schemas).filter(
            (schema) => !names || names.includes(schema.name)
          )
        }
      }))
  );
};

type EventContract = {
  name: string;
  schemas: ExtendedSchemaObject[];
  producers: string[];
  consumers: { id: string; path: string }[];
  conflicts?: string[];
};
const getEventContracts = (): EventContract[] => {
  const services = state().services();
  const consumers = Object.values(services).reduce((consumers, service) => {
    service.eventHandlers &&
      Object.values(service.eventHandlers).forEach(
        (handler) => (consumers[handler.path] = service)
      );
    return consumers;
  }, {} as Record<string, Service>);
  const events = Object.values(state().services()).reduce((events, service) => {
    service.schemas &&
      Object.values(service.schemas).forEach((schema) => {
        const event = (events[schema.name] = events[schema.name] || {
          name: schema.name,
          schemas: [],
          producers: [],
          consumers: []
        });
        event.schemas.push(schema);
        if (schema.refs && schema.refs.length)
          schema.refs.forEach((ref) => {
            const consumer = consumers[ref];
            event.consumers.push({ id: consumer && consumer.id, path: ref });
          });
        else event.producers.push(service.id);
      });
    return events;
  }, {} as Record<string, EventContract>);

  return Object.values(events)
    .map((event) => {
      if (event.schemas.length > 1) {
        event.schemas.sort((a, b) => a.refs?.length - b.refs?.length);
        event.conflicts = getConflicts(event.schemas);
      }
      return event;
    })
    .sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0));
};

router.get(
  "/all",
  (
    req: Request<never, Record<string, ServiceContracts>, never, AllQuery>,
    res: Response<Record<string, ServiceContracts>>
  ) => {
    const { services, names }: AllQuery = {
      services: req.query.services && ensureArray(req.query.services),
      names: req.query.names && ensureArray(req.query.names)
    };
    const contracts = getServiceContracts(
      state()
        .services()
        .filter((s) => !services || services.includes(s.id)),
      names
    );
    res.send(contracts);
  }
);

router.get("/events", (req: Request, res: Response<EventContract[]>) => {
  res.send(getEventContracts());
});

router.get("/", (_, res) => {
  const events = getEventContracts();
  res.render("contracts-explorer", { events });
});
