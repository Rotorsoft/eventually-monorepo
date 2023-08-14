import { z } from "zod";

export const CreateSite = z.object({
  name: z.string(),
  userId: z.string(),
  description: z.string().optional()
})
  