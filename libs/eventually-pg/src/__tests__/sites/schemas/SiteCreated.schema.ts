import { z } from "zod";
import { CreateSite } from "./CreateSite.schema";

export const SiteCreated = CreateSite.and(z.object({}))
  