import { z } from "zod";

export const CompanyIdParamSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
});

/** إنشاء شركة — السوبر أدمن فقط؛ اسم فقط في الطور الحالي */
export const CreateCompanyBodySchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(200),
  })
  .strict();

/** Body optional so idempotent `alreadyArchived` can use empty POST; service validates when company is still active. */
export const CompanyArchiveBodySchema = z
  .object({
    confirmPhrase: z.string().optional(),
  })
  .strict();
