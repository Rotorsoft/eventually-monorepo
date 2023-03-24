import { State } from "@rotorsoft/eventually";
import { Request, Response } from "express";

export const sse = <S extends State>(
  event: string
): {
  push: (req: Request, res: Response) => boolean;
  send: (data: S) => void;
} => {
  const responses = new Set<Response>();
  return {
    push: (req: Request, res: Response): boolean => {
      if (req.headers.accept === "text/event-stream") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        responses.add(res);
        req.on("close", () => responses.delete(res));
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
