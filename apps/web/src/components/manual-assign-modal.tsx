import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { CaptainListItem } from "@/types/api";

type Props = {
  open: boolean;
  onClose: () => void;
  orderLabel: string;
  captains: CaptainListItem[];
  onSubmit: (captainId: string) => void;
  isPending?: boolean;
};

export function ManualAssignModal({ open, onClose, orderLabel, captains, onSubmit, isPending }: Props) {
  const [captainId, setCaptainId] = useState("");

  useEffect(() => {
    if (open) setCaptainId("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="تعيين يدوي" description={`اختر الكابتن للطلب ${orderLabel}`}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="captain-select">الكابتن</Label>
          <select
            id="captain-select"
            className="h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            value={captainId}
            onChange={(e) => setCaptainId(e.target.value)}
          >
            <option value="">— اختر —</option>
            {captains.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.isActive || !c.user.isActive}>
                {c.user.fullName} — {c.user.phone} ({c.availabilityStatus})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" disabled={!captainId || isPending} onClick={() => captainId && onSubmit(captainId)}>
            {isPending ? "جارٍ الإرسال…" : "تأكيد التعيين"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
