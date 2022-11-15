import { log, Payload } from "@rotorsoft/eventually";
import axios, { AxiosRequestHeaders } from "axios";
import { CommittableHttpStatus } from "../cluster";
import { PushChannel } from "../interfaces";
import { PushEvent, PushResponse } from "../types";
import { toAxiosRequestHeaders } from "../utils";

const TIMEOUT = 10000;

const push = async (
  url: string,
  event: PushEvent,
  headers?: AxiosRequestHeaders
): Promise<PushResponse> => {
  try {
    const { status, statusText } = await axios.post(url, event, {
      timeout: TIMEOUT,
      headers
    });
    return { statusCode: status, statusText };
  } catch (error) {
    log().error(error);
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const { status, statusText, data } = error.response;
        return {
          statusCode: status,
          statusText,
          details: data
            ? `${data.message} ${
                data.details ? JSON.stringify(data.details) : ""
              }`
            : undefined
        };
      }
      return {
        statusCode: 503,
        statusText: error.code
      };
    }
    return {
      statusCode: 503,
      statusText: "Internal Server Error",
      details: error instanceof Error ? error.message : JSON.stringify(error)
    };
  }
};

export const HttpPostPushChannel = (
  endpoint: URL,
  headers?: Payload
): PushChannel => {
  const axiosRequestHeaders = headers && toAxiosRequestHeaders(headers);
  return {
    label: "",
    init: () => Promise.resolve(),
    push: async (events) => {
      let lastCode = 200;
      while (events.length) {
        const event = events.shift();
        if (event) {
          event.response = await push(
            endpoint.href,
            event,
            axiosRequestHeaders
          );
          lastCode = event.response.statusCode;
          if (!CommittableHttpStatus.includes(lastCode)) break;
        }
      }
      return lastCode;
    }
  };
};
