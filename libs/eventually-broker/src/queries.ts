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
    services.map(async (s) => {
      if (!s.breaker) return [];
      const { data } = await s.breaker.exec<CommittedEvent[]>(async () => {
        try {
          const data = await getServiceStream(s, {
            correlation,
            limit: 20
          });
          return { data };
        } catch (err: any) {
          log().info(s.url, err.message);
          return { error: err.message };
        }
      });
      // TODO: add source to causation
      return data
        ? data.map(({ id, name, stream, created, metadata }) => {
            if (metadata) {
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
                      name: command?.name || "",
                      type: "command",
                      aggregateid: command?.stream
                    }
              };
              return cm;
            }
          })
        : [];
    })
  );
  return all
    .flat()
    .filter((item): item is Correlation => !!item)
    .sort((a, b) => a.created.getTime() - b.created.getTime());
};

/**
 * Gets service stream
 */
export const getStream = async (
  service: Service,
  query: AllQuery
): Promise<CommittedEvent[]> => {
  if (service.breaker) {
    const { data } = await service.breaker.exec<CommittedEvent[]>(async () => {
      try {
        const data = await getServiceStream(service, query);
        return data
          ? { data: query.backward ? data : data.reverse() }
          : { data: [] };
      } catch (err: any) {
        log().info(service.url, err.message);
        return { error: err.message };
      }
    });
    return data || [];
  }
  return [];
};
