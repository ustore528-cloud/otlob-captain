import { type FormEvent, useEffect, useState } from "react";
import { useCreateUser, useCompaniesForSuperAdmin } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userRoleLabel } from "@/lib/user-role";
import { USER_ROLE_CREATE_OPTIONS } from "@/features/users/constants";
import { CreateCompanyModal } from "./create-company-modal";

export function AddUserFormCard() {
  const create = useCreateUser();
  const companiesQ = useCompaniesForSuperAdmin();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ code: string; fullName: string } | null>(null);

  useEffect(() => {
    if (role !== "COMPANY_ADMIN") {
      setSelectedCompanyId("");
    }
  }, [role]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const roleVal = String(form.get("role") ?? "");
    const emailRaw = String(form.get("email") ?? "").trim();

    const next: Record<string, string> = {};
    if (!fullName) next.fullName = "الاسم مطلوب.";
    if (!phone) next.phone = "الهاتف مطلوب.";
    if (password.length < 8) next.password = "كلمة المرور 8 أحرف على الأقل.";
    if (!roleVal) next.role = "اختر الدور.";
    if (roleVal === "COMPANY_ADMIN") {
      if (!selectedCompanyId) {
        next.companyId = "يرجى اختيار الشركة";
      } else {
        const exists = (companiesQ.data ?? []).some((c) => c.id === selectedCompanyId);
        if (!exists) {
          next.companyId = "الشركة المختارة غير موجودة. حدّث القائمة أو اختر شركة أخرى.";
        }
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    create.mutate(
      {
        fullName,
        phone,
        password,
        role: roleVal,
        ...(emailRaw ? { email: emailRaw } : {}),
        ...(roleVal === "COMPANY_ADMIN" && selectedCompanyId ? { companyId: selectedCompanyId } : {}),
      },
      {
        onSuccess: (data) => {
          e.currentTarget.reset();
          setRole("");
          setSelectedCompanyId("");
          setErrors({});
          if (data.role === "COMPANY_ADMIN" && data.publicOwnerCode) {
            setLastCreated({ code: data.publicOwnerCode, fullName: data.fullName });
          } else {
            setLastCreated(null);
          }
        },
      },
    );
  }

  const err = (k: string) => (errors[k] ? "border-red-500" : "");
  const companies = companiesQ.data ?? [];

  return (
    <Card className="border-card-border border-dashed shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">إضافة مستخدم</CardTitle>
        <CardDescription>
          لإنشاء حساب منصة ضمن النموذج المبسّط الحالي (مدير منصة/مدير شركة). إنشاء الكباتن يتم من صفحة الكباتن.
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
              value={role}
              onChange={(ev) => setRole(ev.target.value)}
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
          {role === "COMPANY_ADMIN" ? (
            <div className="grid gap-2 sm:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="add-company" className="!mb-0">
                  الشركة
                </Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  onClick={() => setCreateCompanyOpen(true)}
                >
                  إنشاء شركة جديدة
                </Button>
              </div>
              <select
                id="add-company"
                className={`h-10 w-full min-w-0 rounded-lg border border-card-border bg-card px-3 text-sm ${err("companyId")}`}
                value={selectedCompanyId}
                onChange={(ev) => setSelectedCompanyId(ev.target.value)}
                disabled={companiesQ.isLoading}
                aria-label="الشركة"
                aria-invalid={Boolean(errors.companyId)}
              >
                <option value="" disabled>
                  اختر الشركة
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {companiesQ.isError ? (
                <p className="text-xs text-red-600">{(companiesQ.error as Error).message}</p>
              ) : null}
              {errors.companyId ? <p className="text-xs text-red-600">{errors.companyId}</p> : null}
              {!companiesQ.isLoading && companies.length === 0 && !companiesQ.isError ? (
                <InlineAlert variant="info">
                  لا توجد شركات بعد. اضغط &quot;إنشاء شركة جديدة&quot; لإضافة شركة ثم اخترها هنا.
                </InlineAlert>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-email">البريد (اختياري)</Label>
            <Input id="add-email" name="email" type="email" dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-password">كلمة المرور</Label>
            <Input id="add-password" name="password" type="password" autoComplete="new-password" className={err("password")} />
            {errors.password ? <p className="text-xs text-red-600">{errors.password}</p> : null}
          </div>
          {lastCreated ? (
            <InlineAlert variant="info" className="sm:col-span-2">
              <p className="font-medium">تم إنشاء مدير الشركة: {lastCreated.fullName}</p>
              <p className="mt-1 text-sm">
                كود المدير: <span className="font-mono">{lastCreated.code}</span> — رابط الطلبات:{" "}
                <span className="font-mono break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/request/${encodeURIComponent(lastCreated.code)}`
                    : ""}
                </span>
              </p>
            </InlineAlert>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "جارٍ الحفظ…" : "إنشاء المستخدم"}
            </Button>
          </div>
        </form>
        <CreateCompanyModal
          open={createCompanyOpen}
          onClose={() => setCreateCompanyOpen(false)}
          onCreated={(c) => setSelectedCompanyId(c.id)}
        />
      </CardContent>
    </Card>
  );
}
