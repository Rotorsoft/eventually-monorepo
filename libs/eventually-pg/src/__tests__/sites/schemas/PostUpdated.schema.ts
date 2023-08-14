import { z } from "zod";
import { UpdatePost } from "./UpdatePost.schema";

export const PostUpdated = UpdatePost.and(z.object({}))
  