import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { useUpdateCaptain, useUsers } from "@/hooks";
import { isBranchManagerRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { CaptainListItem } from "@/types/api";

const VEHICLE_TYPES = ["بسكليت", "دراجه ناريه", "سيارة", "شحن نقل"] as const;
type Props = {
  captain: CaptainListItem | null;
  open: boolean;
  onClose: () => void;
};

export function CaptainEditModal({ captain, open, onClose }: Props) {
  const update = useUpdateCaptain();
  const role = useAuthStore((s) => s.user?.role);
  const me = useAuthStore((s) => s.user);
  const isRegionSupervisor = isBranchManagerRole(role);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[1]);
  const [area, setArea] = useState("");
  const [supervisorUserId, setSupervisorUserId] = useState<string>("");
  const supervisorsBranch = useUsers({ page: 1, pageSize: 100, role: "BRANCH_MANAGER" });
  const supervisorsDispatch = useUsers({ page: 1, pageSize: 100, role: "DISPATCHER" });
  const supervisors = [
    ...(supervisorsBranch.data?.items ?? []),
    ...(supervisorsDispatch.data?.items ?? []),
  ];

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
          vehicleType: vehicleType as (typeof VEHICLE_TYPES)[number],
          area: area.trim(),
          supervisorUserId: isRegionSupervisor ? me?.id ?? null : supervisorUserId || null,
        },
      },
      { onSuccess: () => onClose() },
    );
  }

  if (!captain) return null;

  return (
    <Modal open={open} onClose={onClose} title="تعديل الكابتن" description="تحديث بيانات الحساب والمركبة والمنطقة">
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-fullName">الاسم الكامل</Label>
          <Input id="edit-cap-fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={200} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-phone">الهاتف</Label>
          <Input id="edit-cap-phone" dir="ltr" className="text-left" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-vehicle">نوع المركبة</Label>
          <select
            id="edit-cap-vehicle"
            className={FORM_CONTROL_CLASS}
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-cap-area">المنطقة</Label>
          <Input id="edit-cap-area" value={area} onChange={(e) => setArea(e.target.value)} required maxLength={200} />
        </div>
        {isRegionSupervisor ? (
          <InlineAlert variant="info">كمشرف منطقة، ربط الكابتن بالمشرف يبقى على حسابك.</InlineAlert>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="edit-cap-supervisor">المشرف</Label>
            <select
              id="edit-cap-supervisor"
              className={FORM_CONTROL_CLASS}
              value={supervisorUserId}
              onChange={(e) => setSupervisorUserId(e.target.value)}
            >
              <option value="">بدون مشرف</option>
              {supervisors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {u.role}
                </option>
              ))}
            </select>
          </div>
        )}
        {update.isError ? <InlineAlert variant="error">{(update.error as Error).message}</InlineAlert> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
