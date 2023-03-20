import { State, StateWithId } from "@rotorsoft/eventually";
import { randomUUID } from "crypto";
import { Request, Response } from "express";

export const sse = <S extends State>(): {
  push: (req: Request, res: Response) => boolean;
  send: (data: StateWithId<S>) => void;
} => {
  const responses: Record<string, Response> = {};
  return {
    push: (req: Request, res: Response): boolean => {
      if (req.headers.accept === "text/event-stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "access-control-allow-origin": "*",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no"
        });
        const id = randomUUID();
        responses[id] = res;
        req.on("close", () => {
          delete responses[id];
        });
        return true;
      }
      return false;
    },
    send: (data: StateWithId<S>): void => {
      Object.values(responses).forEach((res) =>
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      );
    }
  };
};
