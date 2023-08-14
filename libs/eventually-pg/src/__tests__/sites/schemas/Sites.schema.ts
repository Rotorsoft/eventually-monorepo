import { z } from "zod";

export const Sites = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  font: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
  image: z.string().optional(),
  userImage: z.string().optional(),
  message404: z.string().optional(),
});
