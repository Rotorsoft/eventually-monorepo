import { z } from "zod";

export const Posts = z.object({
  id: z.string(),
  userId: z.string(),
  siteId: z.string(),
  title: z.string(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  description: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  userImage: z.string().optional()
})
  