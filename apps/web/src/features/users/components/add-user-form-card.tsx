import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    if (!fullName) next.fullName = t("users.addUser.errors.fullName");
    if (!phone) next.phone = t("users.addUser.errors.phone");
    if (password.length < 8) next.password = t("users.addUser.errors.password");
    if (!roleVal) next.role = t("users.addUser.errors.role");
    if (roleVal === "COMPANY_ADMIN") {
      if (!selectedCompanyId) {
        next.companyId = t("users.addUser.errors.companyPick");
      } else {
        const exists = (companiesQ.data ?? []).some((c) => c.id === selectedCompanyId);
        if (!exists) {
          next.companyId = t("users.addUser.errors.companyMissing");
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
        <CardTitle className="text-base">{t("users.addUser.title")}</CardTitle>
        <CardDescription>{t("users.addUser.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit} noValidate>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-fullName">{t("users.addUser.fullName")}</Label>
            <Input id="add-fullName" name="fullName" maxLength={200} className={err("fullName")} />
            {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-phone">{t("users.addUser.phone")}</Label>
            <Input id="add-phone" name="phone" dir="ltr" className={`text-left ${err("phone")}`} />
            {errors.phone ? <p className="text-xs text-red-600">{errors.phone}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-role">{t("users.addUser.role")}</Label>
            <select
              id="add-role"
              name="role"
              className={`h-10 rounded-lg border border-card-border bg-card px-3 text-sm ${err("role")}`}
              value={role}
              onChange={(ev) => setRole(ev.target.value)}
            >
              <option value="" disabled>
                {t("users.addUser.choose")}
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
                  {t("users.company")}
                </Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  onClick={() => setCreateCompanyOpen(true)}
                >
                  {t("users.addUser.createCompany")}
                </Button>
              </div>
              <select
                id="add-company"
                className={`h-10 w-full min-w-0 rounded-lg border border-card-border bg-card px-3 text-sm ${err("companyId")}`}
                value={selectedCompanyId}
                onChange={(ev) => setSelectedCompanyId(ev.target.value)}
                disabled={companiesQ.isLoading}
                aria-label={t("users.addUser.pickCompany")}
                aria-invalid={Boolean(errors.companyId)}
              >
                <option value="" disabled>
                  {t("users.addUser.pickCompany")}
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
                <InlineAlert variant="info">{t("users.addUser.noCompanies")}</InlineAlert>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-email">{t("users.addUser.emailOptional")}</Label>
            <Input id="add-email" name="email" type="email" dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="add-password">{t("users.addUser.password")}</Label>
            <Input id="add-password" name="password" type="password" autoComplete="new-password" className={err("password")} />
            {errors.password ? <p className="text-xs text-red-600">{errors.password}</p> : null}
          </div>
          {lastCreated ? (
            <InlineAlert variant="info" className="sm:col-span-2">
              <p className="font-medium">{t("users.addUser.createdCompanyAdminTitle", { name: lastCreated.fullName })}</p>
              <p className="mt-1 text-sm">
                {t("users.addUser.createdCompanyAdminBody", { code: lastCreated.code })}{" "}
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
              {create.isPending ? t("users.addUser.creating") : t("users.addUser.submit")}
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
