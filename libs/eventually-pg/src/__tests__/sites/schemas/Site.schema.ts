import { z } from "zod";
import { Post } from "./Post.schema";

export const Site = z.object({
  name: z.string(),
  font: z.string(),
  posts: z.record(Post),
  userId: z.string(),
  description: z.string().optional(),
  logo: z.string().optional(),
  image: z.string().optional(),
  message404: z.string().optional(),
});
