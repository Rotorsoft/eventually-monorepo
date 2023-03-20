import { State } from "@rotorsoft/eventually";
import { randomUUID } from "crypto";
import { Request, Response } from "express";

export const sse = <S extends State>(
  event: string
): {
  push: (req: Request, res: Response) => boolean;
  send: (data: S) => void;
} => {
  const responses: Record<string, Response> = {};
  return {
    push: (req: Request, res: Response): boolean => {
      if (req.headers.accept === "text/event-stream") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        const id = randomUUID();
        responses[id] = res;
        req.on("close", () => {
          delete responses[id];
        });
        return true;
      }
      return false;
    },
    send: (data: S): void => {
      Object.values(responses).forEach((res) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      });
    }
  };
};
