import { z } from "zod";

export const UpdatePost = z.object({
  id: z.string(),
  slug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  published: z.boolean().optional(),
});
