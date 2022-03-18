import { log } from "@rotorsoft/eventually";
import axios from "axios";
import { PushChannel } from "../types";

export const postPushChannel = (endpoint: URL): PushChannel => {
  return {
    init: () => undefined,
    push: async (event) => {
      try {
        const response = await axios.post(endpoint.href, event);
        const { status, statusText } = response;
        return { status, statusText };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            const { status, statusText } = error.response;
            return { status, statusText };
          }
          log().error(error);
          return { status: 503, statusText: error.code };
        } else {
          log().error(error);
          return { status: 503, statusText: error.message };
        }
      }
    }
  };
};
