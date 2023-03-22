import { bind, SystemFactory, ZodEmpty } from "@rotorsoft/eventually";
import { AllCommands, AllEvents } from "./calculator.schemas";

// To test case when not reducible command handler produces events that are
// not registered with the builder and there are no local event handlers
export const Forget: SystemFactory<
  Pick<AllCommands, "Forget" | "Whatever">,
  Pick<AllEvents, "Forgotten">
> = () => ({
  description: "Forget System emits forgotten events",
  schemas: {
    commands: {
      Forget: ZodEmpty,
      Whatever: ZodEmpty
    },
    events: {
      Forgotten: ZodEmpty
    }
  },
  stream: "Forget",
  on: {
    Whatever: () => Promise.resolve([]),
    Forget: () => Promise.resolve([bind("Forgotten", {})])
  }
});
