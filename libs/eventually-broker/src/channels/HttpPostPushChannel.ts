import { log } from "@rotorsoft/eventually";
import axios from "axios";
import { PushChannel } from "../interfaces";

export const HttpPostPushChannel = (endpoint: URL): PushChannel => {
  return {
    init: () => undefined,
    push: async (event) => {
      try {
        const response = await axios.post(endpoint.href, event, {
          timeout: 3000
        });
        const { status, statusText } = response;
        return { status, statusText };
      } catch (error) {
        log().error(error);
        if (axios.isAxiosError(error)) {
          if (error.response) {
            const { status, statusText, data } = error.response;
            return {
              status,
              statusText,
              details: data
                ? `${data.message} ${
                    data.details ? JSON.stringify(data.details) : ""
                  }`
                : undefined
            };
          }
          return { status: 503, statusText: error.code };
        }
        return {
          status: 503,
          statusText: "Internal Server Error",
          details:
            error instanceof Error ? error.message : JSON.stringify(error)
        };
      }
    }
  };
};
