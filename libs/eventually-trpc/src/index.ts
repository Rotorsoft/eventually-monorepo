/** @module eventually-trpc */
import {
  type Actor,
  AggregateFactory,
  Errors,
  Messages,
  State,
  client
} from "@rotorsoft/eventually";
import { TRPCError, initTRPC } from "@trpc/server";
import { ZodSchema, z } from "zod";

export interface Context {
  req: Request;
  res: Response;
  actor: Actor;
}

const trpc = initTRPC.context<Context>().create();
export const router = trpc.router;
export const procedure = trpc.procedure;

const trpcError = (error: unknown): TRPCError => {
  if (error instanceof Error) {
    const { name, message, ...other } = error;
    switch (name) {
      case Errors.ValidationError:
      case Errors.InvariantError:
        return new TRPCError({ code: "BAD_REQUEST", message, ...other });

      case Errors.AuthenticationError:
      case Errors.AuthorizationError:
        return new TRPCError({ code: "UNAUTHORIZED", message });

      default:
        return new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `[${name}] ${message}`,
          cause: error
        });
    }
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Oops, something went wrong!"
  });
};

/**
 * Builds tRPC command POST endpoint
 * @param factory aggregate factory
 * @param command command name
 * @param input command schema
 * @returns tRPC mutation procedure
 */
export function command<C extends Messages>(
  factory: AggregateFactory<State, C, Messages>,
  command: keyof C & string,
  input: ZodSchema<{ id: string; expectedVersion?: number }>
): any {
  return procedure
    .input(input)
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, expectedVersion, ...data } = input;
        return await client().command(
          factory,
          command,
          data as C[keyof C & string],
          {
            stream: id,
            expectedVersion,
            actor: ctx.actor
          },
          true
        );
      } catch (error) {
        throw trpcError(error);
      }
    });
}
