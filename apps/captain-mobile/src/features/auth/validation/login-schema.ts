import { z } from "zod";

export const loginFormSchema = z
  .object({
    identifier: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "أدخل رقم الجوال أو البريد الإلكتروني")),
    password: z.string().min(1, "أدخل كلمة المرور"),
  })
  .superRefine((data, ctx) => {
    const id = data.identifier;
    if (id.includes("@")) {
      const r = z.string().email().safeParse(id);
      if (!r.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "بريد إلكتروني غير صالح",
          path: ["identifier"],
        });
      }
    } else if (id.length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "رقم الجوال قصير جدًا",
        path: ["identifier"],
      });
    }
  });

export type LoginFormValues = z.infer<typeof loginFormSchema>;
