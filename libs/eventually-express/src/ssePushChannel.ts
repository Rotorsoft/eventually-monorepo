import { PushChannel } from "@rotorsoft/eventually";
import EventEmitter from "events";
import { Request, Response } from "express";

// TODO: scalability concerns - too many open connections in worker process
export const ssePushChannel = (): PushChannel => {
  const bus = new EventEmitter();
  let connected = false;
  const buffer: any[] = [];

  return {
    init: (...args: any) => {
      const req: Request = args[0];
      const res: Response = args[1];

      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Content-Encoding", "none");

      req.on("close", () => {
        connected = false;
        bus.removeAllListeners();
      });

      bus.on("data", (event) => {
        res.write(`id: ${event.id}\n`);
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      while (buffer.length) {
        bus.emit(buffer.shift());
      }
      connected = true;
    },

    push: (event) => {
      if (connected) bus.emit("data", event);
      else buffer.push(event);
      return Promise.resolve({ status: 200, statusText: "OK" });
    }
  };
};
