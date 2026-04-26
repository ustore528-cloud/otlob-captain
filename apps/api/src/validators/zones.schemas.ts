import { z } from "zod";

export const ListZonesQuerySchema = z.object({
  companyId: z.string().cuid().optional(),
});
