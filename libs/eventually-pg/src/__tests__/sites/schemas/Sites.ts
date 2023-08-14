import { SiteCreated } from "./SiteCreated.schema";
import { SiteDeleted } from "./SiteDeleted.schema";
import { SiteUpdated } from "./SiteUpdated.schema";
import { Sites } from "./Sites.schema";

export const SitesSchemas = {
  state: Sites,
  events: {
    SiteCreated,
    SiteUpdated,
    SiteDeleted
  }
};
