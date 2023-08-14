import { CreatePost } from "./CreatePost.schema";
import { CreateSite } from "./CreateSite.schema";
import { DeletePost } from "./DeletePost.schema";
import { DeleteSite } from "./DeleteSite.schema";
import { PostCreated } from "./PostCreated.schema";
import { PostDeleted } from "./PostDeleted.schema";
import { PostUpdated } from "./PostUpdated.schema";
import { Site } from "./Site.schema";
import { SiteCreated } from "./SiteCreated.schema";
import { SiteDeleted } from "./SiteDeleted.schema";
import { SiteUpdated } from "./SiteUpdated.schema";
import { UpdatePost } from "./UpdatePost.schema";
import { UpdateSite } from "./UpdateSite.schema";

export const SiteSchemas = {
  state: Site,
  commands: {
    CreateSite,
    UpdateSite,
    DeleteSite,
    CreatePost,
    UpdatePost,
    DeletePost
  },
  events: {
    SiteCreated,
    SiteUpdated,
    SiteDeleted,
    PostCreated,
    PostUpdated,
    PostDeleted
  }
};
