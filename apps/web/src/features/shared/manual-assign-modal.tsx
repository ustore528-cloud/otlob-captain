import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { availabilityAr } from "@/features/captains/lib/availability-ar";
import type { CaptainListItem } from "@/types/api";

type Props = {
  open: boolean;
  onClose: () => void;
  orderLabel: string;
  title?: string;
  description?: string;
  captains: CaptainListItem[];
  onSubmit: (captainId: string) => void;
  isPending?: boolean;
  /** Shown when `captains` is empty (e.g. no in-scope captains for SUPERVISOR_LINKED). */
  emptyHint?: string;
};

export function ManualAssignModal({
  open,
  onClose,
  orderLabel,
  title,
  description,
  captains,
  onSubmit,
  isPending,
  emptyHint,
}: Props) {
  const { t } = useTranslation();
  const [captainId, setCaptainId] = useState("");
  const resolvedTitle = title ?? t("manualAssign.title");
  const resolvedDescription = description ?? t("manualAssign.description", { order: orderLabel });

  useEffect(() => {
    if (open) setCaptainId("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={resolvedTitle} description={resolvedDescription}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="captain-select">{t("manualAssign.captain")}</Label>
          {emptyHint && captains.length === 0 ? (
            <InlineAlert variant="warning">{emptyHint}</InlineAlert>
          ) : null}
          <select
            id="captain-select"
            className={FORM_CONTROL_CLASS}
            value={captainId}
            onChange={(e) => setCaptainId(e.target.value)}
            disabled={captains.length === 0}
          >
            <option value="">{t("manualAssign.choose")}</option>
            {captains.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.isActive || !c.user.isActive}>
                {c.user.fullName} — {c.user.phone} ({availabilityAr(c.availabilityStatus)}) ·{" "}
                {c.supervisorUser
                  ? `${t("manualAssign.supervisorPrefix")}: ${c.supervisorUser.fullName}`
                  : t("manualAssign.noSupervisorShort")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!captainId || isPending} onClick={() => captainId && onSubmit(captainId)}>
            {isPending ? t("manualAssign.sending") : t("manualAssign.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
