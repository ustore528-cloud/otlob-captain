import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { useUpdateCaptain, useUsers } from "@/hooks";
import {
  CAPTAIN_VEHICLE_OPTIONS,
  DEFAULT_CAPTAIN_VEHICLE_VALUE,
} from "@/features/captains/lib/captain-vehicle-options";
import { isBranchManagerRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { CaptainListItem } from "@/types/api";
import { userListItemNameDisplay } from "@/i18n/localize-entity-labels";

type Props = {
  captain: CaptainListItem | null;
  open: boolean;
  onClose: () => void;
};

export function CaptainEditModal({ captain, open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const update = useUpdateCaptain();
  const role = useAuthStore((s) => s.user?.role);
  const me = useAuthStore((s) => s.user);
  const isRegionSupervisor = isBranchManagerRole(role);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(DEFAULT_CAPTAIN_VEHICLE_VALUE);
  const [area, setArea] = useState("");
  const [supervisorUserId, setSupervisorUserId] = useState<string>("");
  const supervisorsBranch = useUsers({ page: 1, pageSize: 100, role: "BRANCH_MANAGER" });
  const supervisorsDispatch = useUsers({ page: 1, pageSize: 100, role: "DISPATCHER" });
  const supervisors = [
    ...(supervisorsBranch.data?.items ?? []),
    ...(supervisorsDispatch.data?.items ?? []),
  ];

  const vehicleSelectOptions = useMemo(() => {
    const base = CAPTAIN_VEHICLE_OPTIONS.map((o) => ({ value: o.value, labelKey: o.labelKey }));
    if (captain && !base.some((o) => o.value === captain.vehicleType)) {
      return [{ value: captain.vehicleType, labelKey: null }, ...base];
    }
    return base;
  }, [captain]);

  useEffect(() => {
    if (!captain) return;
    setFullName(captain.user.fullName);
    setPhone(captain.user.phone);
    setVehicleType(captain.vehicleType);
    setArea(captain.area);
    setSupervisorUserId(captain.supervisorUser?.id ?? "");
  }, [captain]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captain) return;
    update.mutate(
      {
        id: captain.id,
        body: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          vehicleType,
          area: area.trim(),
          supervisorUserId: isRegionSupervisor ? me?.id ?? null : supervisorUserId || null,
        },
      },
      { onSuccess: () => onClose() },
    );
  }

  if (!captain) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("captains.edit.title")} description={t("captains.edit.description")}>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-fullName">{t("common.fullName")}</Label>
          <Input id="edit-cap-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-phone">{t("common.phone")}</Label>
          <Input id="edit-cap-phone" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-vehicle">{t("captains.fields.vehicleType")}</Label>
          <select
            id="edit-cap-vehicle"
            className={FORM_CONTROL_CLASS}
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            {vehicleSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelKey ? t(o.labelKey) : o.value}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-area">{t("captains.fields.area")}</Label>
          <Input id="edit-cap-area" value={area} onChange={(e) => setArea(e.target.value)} required maxLength={200} />
        </div>
        {isRegionSupervisor ? (
          <InlineAlert variant="info">{t("captains.edit.branchManagerSupervisorHint")}</InlineAlert>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="edit-cap-supervisor">{t("captains.fields.supervisor")}</Label>
            <select
              id="edit-cap-supervisor"
              className={FORM_CONTROL_CLASS}
              value={supervisorUserId}
              onChange={(e) => setSupervisorUserId(e.target.value)}
            >
              <option value="">{t("stores.page.noSupervisor")}</option>
              {supervisors.map((u) => (
                <option key={u.id} value={u.id}>
                  {userListItemNameDisplay(u, lang)} — {u.role}
                </option>
              ))}
            </select>
          </div>
        )}
        {update.isError ? <InlineAlert variant="error">{(update.error as Error).message}</InlineAlert> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
