import { PostCreated } from "./PostCreated.schema";
import { PostDeleted } from "./PostDeleted.schema";
import { PostUpdated } from "./PostUpdated.schema";
import { Posts } from "./Posts.schema";

export const PostsSchemas = {
  state: Posts,
  events: {
    PostCreated,
    PostUpdated,
    PostDeleted
  }
};
