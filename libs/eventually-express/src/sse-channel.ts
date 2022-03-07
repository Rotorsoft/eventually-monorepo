import { CommittedEvent, log, Payload } from "@rotorsoft/eventually";
import EventEmitter from "events";
import { Request, Response } from "express";
import { Channel } from "./types";

export default (name: string): Channel => {
  let opened = false;
  const buffer: CommittedEvent<string, Payload>[] = [];
  const bus = new EventEmitter();
  return {
    open: (req: Request, res: Response): void => {
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
        opened = false;
        bus.removeAllListeners();
      });
      bus.on("data", (event) => {
        log().trace("red", `${name} sending event ${event.id}...`);
        res.write(`id: ${event.id}\n`);
        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      opened = true;
      while (buffer.length) {
        const event = buffer.shift();
        bus.emit("data", event);
      }
    },
    emit: (event: CommittedEvent<string, Payload>) => {
      if (opened) bus.emit("data", event);
      else buffer.push(event);
    }
  };
};
