import { z } from "zod";

export const ListBranchesQuerySchema = z.object({
  companyId: z.string().cuid().optional(),
});
