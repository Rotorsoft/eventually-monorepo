import { z } from "zod";

export const Post = z.object({
  userId: z.string(),
  title: z.string(),
  published: z.boolean(),
  description: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional()
})
  