import { AllQuery, CommittedEvent, log } from "@rotorsoft/eventually";
import axios from "axios";
import { state } from "./cluster";
import { getEventContract } from "./specs";
import { Service } from "./types";
import { toQueryString } from "./utils";

const HTTP_TIMEOUT = 5000;

export const getServiceStream = async (
  service: Service,
  query: AllQuery
): Promise<CommittedEvent[] | undefined> => {
  const url = new URL(service.url);
  if (!url.protocol.startsWith("http")) return;
  if (!service.allPath) return;
  const secretsQueryString =
    state().serviceSecretsQueryString(service.id) || "?";
  const path = `${url.origin}/all${secretsQueryString}&${toQueryString(query)}`;
  const { data } = await axios.get<CommittedEvent[]>(path, {
    timeout: HTTP_TIMEOUT
  });
  return data;
};

/**
 * Correlation types
 */
type CorrelationMessage = {
  name: string;
  type: "command" | "event";
  id?: number;
  producer?: string;
  stream?: string;
  aggregateid?: string;
  actor?: string;
};
type Correlation = CorrelationMessage & {
  created: Date;
  service: string;
  causation?: CorrelationMessage;
};
/**
 * Gets correlation metadata
 * @param correlation The correlation id
 * @param services The services to search
 * @returns The correlation metadata
 */
export const getCorrelation = async (
  correlation: string
): Promise<Correlation[]> => {
  const services = state().services();
  const all = await Promise.all(
    services
      .filter((s) => s.breaker)
      .map(async (s) => {
        const { data } = await s.breaker.exec<CommittedEvent[]>(async () => {
          try {
            const data = await getServiceStream(s, {
              correlation,
              limit: 20
            });
            return { data };
          } catch (err) {
            log().error(err);
            return { error: err.message };
          }
        });
        // TODO: add source to causation
        return data
          ? data.map(({ id, name, stream, created, metadata }) => {
              const { command, event } = metadata.causation;
              const contract = event && getEventContract(event.name);
              const producer = contract && Object.keys(contract.producers)[0];
              const cm: Correlation = {
                created: new Date(created),
                service: s.id,
                id,
                name,
                type: "event",
                stream,
                causation: event
                  ? {
                      producer,
                      name: event.name,
                      type: "event",
                      id: event.id,
                      stream: event.stream
                    }
                  : {
                      name: command?.name,
                      type: "command",
                      aggregateid: command?.id
                    }
              };
              return cm;
            })
          : [];
      })
  );
  return all.flat().sort((a, b) => a.created.getTime() - b.created.getTime());
};

/**
 * Gets service stream
 */
export const getStream = async (
  service: Service,
  query: AllQuery
): Promise<CommittedEvent[]> => {
  const { data } = await service.breaker.exec<CommittedEvent[]>(async () => {
    try {
      const data = await getServiceStream(service, query);
      return { data: query.backward ? data : data.reverse() };
    } catch (err) {
      log().error(err);
      return { error: err.message };
    }
  });
  return data || [];
};
