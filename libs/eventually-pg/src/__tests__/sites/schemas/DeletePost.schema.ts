import { z } from "zod";

export const DeletePost = z.object({
  id: z.string().uuid()
})
  