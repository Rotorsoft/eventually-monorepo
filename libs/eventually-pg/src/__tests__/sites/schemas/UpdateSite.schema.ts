import { z } from "zod";

export const UpdateSite = z.object({
  name: z.string().optional(),
  font: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  image: z.string().optional(),
  message404: z.string().optional()
})
  