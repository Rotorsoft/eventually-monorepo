import { log } from "@rotorsoft/eventually";
import axios from "axios";
import { PushChannel } from "../types";

export const HttpPostPushChannel = (endpoint: URL): PushChannel => {
  return {
    init: () => undefined,
    push: async (event) => {
      try {
        const response = await axios.post(endpoint.href, event);
        const { status, statusText } = response;
        return { status, statusText };
      } catch (error) {
        log().error(error);
        if (axios.isAxiosError(error)) {
          if (error.response) {
            const { status, statusText } = error.response;
            return { status, statusText };
          }
          return { status: 503, statusText: error.code };
        }
        return { status: 503, statusText: error.message };
      }
    }
  };
};
