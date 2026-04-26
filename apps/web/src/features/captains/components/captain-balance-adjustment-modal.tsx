import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

type Mode = "increase" | "decrease";

type Props = {
  open: boolean;
  captainLabel: string;
  isPending?: boolean;
  onClose: () => void;
  onSubmit: (payload: { amount: number; note: string }) => void;
};

export function CaptainBalanceAdjustmentModal({ open, captainLabel, isPending, onClose, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>("increase");
  const [amountRaw, setAmountRaw] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("increase");
    setAmountRaw("");
    setNote("");
    setError(null);
  }, [open]);

  const submit = () => {
    setError(null);
    const amount = Number(amountRaw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغاً صحيحاً أكبر من صفر.");
      return;
    }
    if (!note.trim()) {
      setError("سبب التعديل مطلوب.");
      return;
    }
    onSubmit({
      amount: mode === "increase" ? amount : -amount,
      note: note.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="تعديل رصيد الكابتن" description={`الكابتن: ${captainLabel}`}>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>نوع العملية</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={mode === "increase" ? "default" : "secondary"} onClick={() => setMode("increase")}>
              زيادة (+)
            </Button>
            <Button type="button" size="sm" variant={mode === "decrease" ? "default" : "secondary"} onClick={() => setMode("decrease")}>
              خصم (-)
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="captain-adjust-amount">المبلغ</Label>
          <Input
            id="captain-adjust-amount"
            dir="ltr"
            className="text-left"
            inputMode="decimal"
            placeholder="0.00"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="captain-adjust-note">سبب التعديل</Label>
          <textarea
            id="captain-adjust-note"
            className={FORM_CONTROL_CLASS}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اكتب سبباً واضحاً للتدقيق لاحقاً"
          />
        </div>

        {error ? <InlineAlert variant="warning">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? "جارٍ الحفظ…" : "تأكيد التعديل"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
