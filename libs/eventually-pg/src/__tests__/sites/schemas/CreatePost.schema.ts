import { z } from "zod";

export const CreatePost = z.object({
  slug: z.string(),
  userId: z.string(),
  title: z.string(),
  published: z.boolean()
})
  