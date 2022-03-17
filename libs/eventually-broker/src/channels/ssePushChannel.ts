import { log, randomId } from "@rotorsoft/eventually";
import { Request, Response } from "express";
import { Writable } from "stream";
import { PushChannel } from "../types";

// TODO: scalability concerns - how many concurrent connections can a single process handle? process affinity?
// TODO: this is a naive in-memory buffer implementation, use a persisted queue (redis?) instead
export const ssePushChannel = (): PushChannel => {
  const id = randomId();
  const buffer: any[] = [];
  let stream: Writable;

  const write = (): void => {
    if (stream) {
      log().trace("green", `[${id}] sse pushing ${buffer.length} events...`);
      while (buffer.length) {
        const e = buffer.shift();
        stream.write(`id: ${e.id}\n`);
        stream.write(`event: message\n`);
        stream.write(`data: ${JSON.stringify(e)}\n\n`);
      }
    }
  };

  return {
    init: (...args: any) => {
      const req: Request = args[0];
      const res: Response = args[1];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-store");

      req.on("error", (error) => {
        log().error(error);
      });

      req.on("close", () => {
        stream = undefined;
      });

      stream = res;
      write();
    },

    push: (event) => {
      log().trace("green", `[${id}] sse push ${event.id}/${buffer.length}`);
      buffer.push(event);
      write();
      return Promise.resolve({ status: 200, statusText: "OK" });
    }
  };
};
