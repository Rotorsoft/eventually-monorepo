import { z } from "zod";
import { CreatePost } from "./CreatePost.schema";

export const PostCreated = CreatePost.and(z.object({}))
  