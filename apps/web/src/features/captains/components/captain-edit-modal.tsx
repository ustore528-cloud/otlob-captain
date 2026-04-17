import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCaptain } from "@/hooks";
import type { CaptainListItem } from "@/types/api";

const VEHICLE_TYPES = ["بسكليت", "دراجه ناريه", "سيارة", "شحن نقل"] as const;
const selectClass =
  "h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

type Props = {
  captain: CaptainListItem | null;
  open: boolean;
  onClose: () => void;
};

export function CaptainEditModal({ captain, open, onClose }: Props) {
  const update = useUpdateCaptain();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[1]);
  const [area, setArea] = useState("");

  useEffect(() => {
    if (!captain) return;
    setFullName(captain.user.fullName);
    setPhone(captain.user.phone);
    setVehicleType(captain.vehicleType);
    setArea(captain.area);
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
            className={selectClass}
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
        {update.isError ? <p className="text-sm text-red-600">{(update.error as Error).message}</p> : null}
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
