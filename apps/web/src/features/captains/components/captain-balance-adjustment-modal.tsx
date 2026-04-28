import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      setError(t("captains.balanceAdjustment.errors.invalidAmount"));
      return;
    }
    if (!note.trim()) {
      setError(t("captains.balanceAdjustment.errors.noteRequired"));
      return;
    }
    onSubmit({
      amount: mode === "increase" ? amount : -amount,
      note: note.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("captains.balanceAdjustment.title")} description={t("captains.balanceAdjustment.captainLabel", { name: captainLabel })}>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>{t("captains.balanceAdjustment.operationType")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={mode === "increase" ? "default" : "secondary"} onClick={() => setMode("increase")}>
              {t("captains.balanceAdjustment.increase")}
            </Button>
            <Button type="button" size="sm" variant={mode === "decrease" ? "default" : "secondary"} onClick={() => setMode("decrease")}>
              {t("captains.balanceAdjustment.decrease")}
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="captain-adjust-amount">{t("captains.balanceAdjustment.amount")}</Label>
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
          <Label htmlFor="captain-adjust-note">{t("captains.balanceAdjustment.note")}</Label>
          <textarea
            id="captain-adjust-note"
            className={FORM_CONTROL_CLASS}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("captains.balanceAdjustment.notePlaceholder")}
          />
        </div>

        {error ? <InlineAlert variant="warning">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {isPending ? t("common.saving") : t("captains.balanceAdjustment.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
