import { z } from "zod";
import { DeletePost } from "./DeletePost.schema";

export const PostDeleted = DeletePost.and(z.object({}))
  