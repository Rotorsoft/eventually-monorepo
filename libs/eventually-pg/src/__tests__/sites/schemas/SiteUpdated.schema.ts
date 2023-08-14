import { z } from "zod";
import { UpdateSite } from "./UpdateSite.schema";

export const SiteUpdated = UpdateSite.and(z.object({}))
  