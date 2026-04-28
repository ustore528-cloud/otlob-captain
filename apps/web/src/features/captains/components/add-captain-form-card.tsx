import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";
import { useCreateCaptain, useBranches, useZones, useCompaniesForSuperAdmin } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import {
  CAPTAIN_VEHICLE_OPTIONS,
  DEFAULT_CAPTAIN_VEHICLE_VALUE,
} from "@/features/captains/lib/captain-vehicle-options";
import { isBranchManagerRole, isSuperAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function AddCaptainFormCard() {
  const { t } = useTranslation();
  const create = useCreateCaptain();
  const role = useAuthStore((s) => s.user?.role);
  const me = useAuthStore((s) => s.user);
  const isRegionSupervisor = isBranchManagerRole(role);
  const isSuper = isSuperAdminRole(role);
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const [superCompanyId, setSuperCompanyId] = useState("");

  const companiesQ = useCompaniesForSuperAdmin({ enabled: isSuper });
  const branchesEnabled = isRegionSupervisor ? false : isSuper ? Boolean(superCompanyId) : true;
  const branchListCompanyId = isSuper ? superCompanyId : companyId;
  const branchesQ = useBranches(branchListCompanyId, { enabled: branchesEnabled });

  const zonesCompanyId = isSuper ? superCompanyId : companyId;
  const zonesEnabled = !isRegionSupervisor && (isSuper ? Boolean(superCompanyId) : true);
  const zonesQ = useZones(zonesCompanyId, { enabled: zonesEnabled });

  const branches = branchesQ.data ?? [];
  const [branchId, setBranchId] = useState("");
  const [branchError, setBranchError] = useState("");

  const showBranchField = !isRegionSupervisor;
  const activeBranchCount = showBranchField ? branches.length : 0;
  const needBranchPicker = showBranchField && activeBranchCount > 1;
  const singleBranch = showBranchField && activeBranchCount === 1 ? branches[0] : null;
  const canSubmitByBranch = isRegionSupervisor
    ? true
    : isSuper
      ? Boolean(superCompanyId) &&
        !branchesQ.isLoading &&
        !branchesQ.isError &&
        activeBranchCount > 0 &&
        (!needBranchPicker || Boolean(branchId))
      : !branchesQ.isLoading && !branchesQ.isError && (!needBranchPicker || Boolean(branchId));

  useEffect(() => {
    if (isRegionSupervisor || !branchesQ.isSuccess) return;
    if (branches.length === 1) {
      setBranchId(branches[0]!.id);
    } else if (branches.length > 1) {
      setBranchId((prev) => (prev && branches.some((b) => b.id === prev) ? prev : ""));
    } else {
      setBranchId("");
    }
  }, [isRegionSupervisor, branchesQ.isSuccess, branches]);

  function onCreateCaptain(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSuper && !superCompanyId) {
      setBranchError(t("captains.add.errors.chooseCompany"));
      return;
    }
    if (!isRegionSupervisor) {
      if (needBranchPicker && !branchId) {
        setBranchError(t("captains.add.errors.chooseBranch"));
        return;
      }
      setBranchError("");
    }

    const f = new FormData(e.currentTarget);
    const emailRaw = String(f.get("email") ?? "").trim();
    const resolvedBranchId = isRegionSupervisor
      ? undefined
      : singleBranch
        ? singleBranch.id
        : needBranchPicker
          ? branchId
          : undefined;

    const zoneIdRaw = String(f.get("zoneId") ?? "").trim();
    const body = {
      fullName: String(f.get("fullName") ?? "").trim(),
      phone: String(f.get("phone") ?? "").trim(),
      password: String(f.get("password") ?? ""),
      vehicleType: String(f.get("vehicleType") ?? "").trim(),
      area: String(f.get("area") ?? "").trim(),
      ...(emailRaw ? { email: emailRaw } : {}),
      ...(isSuper && superCompanyId ? { companyId: superCompanyId } : {}),
      ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
      ...(zoneIdRaw ? { zoneId: zoneIdRaw } : {}),
    };

    create.mutate(body, {
      onSuccess: () => {
        e.currentTarget.reset();
        setSuperCompanyId("");
      },
    });
  }

  return (
    <Card className="border-card-border shadow-sm ring-1 ring-card-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <UserPlus className="size-5 text-primary" />
        <div>
          <CardTitle className="text-base">{t("captains.add.title")}</CardTitle>
          <CardDescription>
            {isRegionSupervisor
              ? t("captains.add.descriptionBranchManager")
              : isSuper
                ? t("captains.add.descriptionSuperAdmin")
                : t("captains.add.descriptionDefault")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateCaptain}>
          {isSuper ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="superCompanyId">{t("users.company")}</Label>
              {companiesQ.isLoading ? (
                <InlineAlert variant="info">{t("common.loading")}</InlineAlert>
              ) : companiesQ.isError ? (
                <InlineAlert variant="error">{(companiesQ.error as Error).message}</InlineAlert>
              ) : (
                <select
                  id="superCompanyId"
                  name="superCompanyId"
                  required
                  className={FORM_CONTROL_CLASS}
                  value={superCompanyId}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setSuperCompanyId(v);
                    setBranchId("");
                    setBranchError("");
                  }}
                >
                  <option value="">{t("captains.add.selectCompany")}</option>
                  {(companiesQ.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="fullName">{t("captains.fields.captainName")}</Label>
            <Input id="fullName" name="fullName" required autoComplete="name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">{t("common.phone")}</Label>
            <Input id="phone" name="phone" required dir="ltr" className="text-left" autoComplete="tel" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("common.emailOptional")}</Label>
            <Input id="email" name="email" type="email" dir="ltr" className="text-left" autoComplete="email" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          {showBranchField && branchesQ.isLoading ? (
            <InlineAlert variant="info" className="sm:col-span-2">
              {t("captains.add.loadingBranches")}
            </InlineAlert>
          ) : null}
          {showBranchField && branchesQ.isError ? (
            <InlineAlert variant="error" className="sm:col-span-2">
              {(branchesQ.error as Error).message}
            </InlineAlert>
          ) : null}
          {showBranchField && isSuper && !branchesQ.isLoading && branchesEnabled && activeBranchCount === 0 ? (
            <InlineAlert variant="warning" className="sm:col-span-2">
              {t("captains.add.errors.noActiveBranch")}
            </InlineAlert>
          ) : null}
          {!isRegionSupervisor && zonesQ.data && zonesQ.data.length > 0 ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="zoneId">{t("captains.fields.area")}</Label>
              <select id="zoneId" name="zoneId" className={FORM_CONTROL_CLASS} defaultValue="">
                <option value="">{t("common.optional")}</option>
                {zonesQ.data.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.cityName} — {z.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showBranchField && !branchesQ.isLoading && needBranchPicker ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="branchId">{t("captains.fields.branch")}</Label>
              <select
                id="branchId"
                name="branchId"
                required
                className={FORM_CONTROL_CLASS}
                value={branchId}
                onChange={(ev) => {
                  setBranchId(ev.target.value);
                  if (ev.target.value) setBranchError("");
                }}
              >
                <option value="">{t("captains.add.selectBranch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isSuper && branches.some((o) => o.companyId !== b.companyId)
                      ? `${b.companyName} — ${b.name}`
                      : b.name}
                  </option>
                ))}
              </select>
              {branchError ? <p className="text-sm text-destructive">{branchError}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="vehicleType">{t("captains.fields.vehicleType")}</Label>
            <select id="vehicleType" name="vehicleType" required className={FORM_CONTROL_CLASS} defaultValue={DEFAULT_CAPTAIN_VEHICLE_VALUE}>
              {CAPTAIN_VEHICLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area">{t("captains.fields.areaCity")}</Label>
            <Input id="area" name="area" required autoComplete="address-level2" />
          </div>
          {isRegionSupervisor ? (
            <InlineAlert variant="info" className="sm:col-span-2">
              {t("captains.add.supervisorAutoBind", { name: me?.fullName ?? t("captains.add.currentAccount") })}
            </InlineAlert>
          ) : null}
          {create.isError ? (
            <InlineAlert variant="error" className="sm:col-span-2">
              {(create.error as Error).message}
            </InlineAlert>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending || !canSubmitByBranch}>
              {create.isPending ? t("captains.add.creating") : t("captains.add.saveCaptain")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
