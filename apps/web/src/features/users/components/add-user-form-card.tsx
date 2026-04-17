import { type FormEvent, useState } from "react";
import { useCreateUser } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userRoleLabel } from "@/lib/user-role";
import { USER_ROLE_CREATE_OPTIONS } from "@/features/users/constants";

export function AddUserFormCard() {
  const create = useCreateUser();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const role = String(form.get("role") ?? "");
    const emailRaw = String(form.get("email") ?? "").trim();

    const next: Record<string, string> = {};
    if (!fullName) next.fullName = "الاسم مطلوب.";
    if (!phone) next.phone = "الهاتف مطلوب.";
    if (password.length < 8) next.password = "كلمة المرور 8 أحرف على الأقل.";
    if (!role) next.role = "اختر الدور.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    create.mutate(
      {
        fullName,
        phone,
        password,
        role,
        ...(emailRaw ? { email: emailRaw } : {}),
      },
      {
        onSuccess: () => {
          e.currentTarget.reset();
          setErrors({});
        },
      },
    );
  }

  const err = (k: string) => (errors[k] ? "border-red-500" : "");

  return (
    <Card className="border-card-border border-dashed shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">إضافة مستخدم</CardTitle>
        <CardDescription>
          للكابتن مع ملف توصيل يُفضّل استخدام صفحة الكباتن. هنا لإنشاء حساب منصة (مشغّل، متجر، …).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-fullName">الاسم الكامل</Label>
            <Input id="add-fullName" name="fullName" maxLength={200} className={err("fullName")} />
            {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-phone">الهاتف</Label>
            <Input id="add-phone" name="phone" dir="ltr" className={`text-left ${err("phone")}`} />
            {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-role">الدور</Label>
            <select
              id="add-role"
              name="role"
              className={`h-10 rounded-lg border border-card-border bg-card px-3 text-sm ${err("role")}`}
              defaultValue=""
            >
              <option value="" disabled>
                اختر…
              </option>
              {USER_ROLE_CREATE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {userRoleLabel(r)}
                </option>
              ))}
            </select>
            {errors.role ? <p className="text-xs text-red-600">{errors.role}</p> : null}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-email">البريد (اختياري)</Label>
            <Input id="add-email" name="email" type="email" dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-password">كلمة المرور</Label>
            <Input id="add-password" name="password" type="password" autoComplete="new-password" className={err("password")} />
            {errors.password ? <p className="text-xs text-red-600">{errors.password}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "جارٍ الحفظ…" : "إنشاء المستخدم"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
