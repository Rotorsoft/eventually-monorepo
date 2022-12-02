import { CommittedEvent } from "@rotorsoft/eventually";
import * as schemas from "../accounts.schemas";

export const trigger = (
  id: string
): CommittedEvent<Pick<schemas.Events, "AccountCreated">> => ({
  id: 1,
  version: 1,
  stream: "main",
  created: new Date(),
  name: "AccountCreated",
  data: { id },
  metadata: { correlation: "", causation: {} }
});
