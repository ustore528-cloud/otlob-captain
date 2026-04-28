import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useCaptains } from "@/hooks/captains/use-captains";
import { api } from "@/lib/api/singleton";
import { ApiError } from "@/lib/api/http";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import { captainOptionLabel } from "@/i18n/localize-entity-labels";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const t = s.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function mapError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === "TENANT_SCOPE_REQUIRED") {
      return t("finance.modals.companyAdminCaptainPrepaid.errors.tenantScope");
    }
    if (err.status === 403) {
      return t("finance.modals.companyAdminCaptainPrepaid.errors.captainOutOfCompany");
    }
    if (err.code === "REASON_REQUIRED") {
      return t("finance.modals.companyAdminCaptainPrepaid.errors.reasonRequired");
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return t("finance.modals.common.genericCompleteError");
}

type Props = {
  open: boolean;
  onClose: () => void;
  defaultCaptainId: string | null;
};

export function CompanyAdminCaptainPrepaidModal({ open, onClose, defaultCaptainId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const captains = useCaptains({ page: 1, pageSize: 100 }, { enabled: open });

  const charge = useMutation({
    mutationFn: (vars: { captainId: string; amount: string; reason: string; idempotencyKey: string }) =>
      api.finance.companyAdminPrepaidChargeCaptain(vars.captainId, {
        amount: vars.amount,
        reason: vars.reason,
        idempotencyKey: vars.idempotencyKey,
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.captainWallet(variables.captainId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
  });

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }
    charge.reset();
    setIdempotencyKey(crypto.randomUUID());
    setAmountInput("");
    setReason("");
    setFormError(null);
  }, [open, charge.reset]);

  useEffect(() => {
    if (!open) return;
    const items = captains.data?.items ?? [];
    if (!items.length) return;
    if (defaultCaptainId && items.some((c) => c.id === defaultCaptainId)) {
      setCaptainId(defaultCaptainId);
    } else {
      setCaptainId((c) => (c && items.some((x) => x.id === c) ? c : items[0]!.id));
    }
  }, [open, defaultCaptainId, captains.data?.items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!captainId) {
      setFormError(t("finance.modals.companyAdminCaptainPrepaid.pickCaptain"));
      return;
    }
    if (!idempotencyKey) {
      setFormError(t("finance.modals.common.idempotencyNotReady"));
      return;
    }
    const r = reason.trim();
    if (!r) {
      setFormError(t("finance.modals.common.reasonRequired"));
      return;
    }
    const amount = normalizeAmount(amountInput);
    if (!amount) {
      setFormError(t("finance.modals.common.positiveAmount"));
      return;
    }
    void charge.mutate({ captainId, amount, reason: r, idempotencyKey });
  };

  const serverError = charge.isError ? mapError(charge.error, t) : null;
  const done = charge.isSuccess;
  const result = charge.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("finance.modals.companyAdminCaptainPrepaid.title")}
      description={t("finance.modals.companyAdminCaptainPrepaid.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.companyAdminCaptainPrepaid.successNoop")
              : t("finance.modals.companyAdminCaptainPrepaid.success")}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            {t("finance.modals.companyAdminCaptainPrepaid.balanceLine", { value: result.prepaidBalance })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ca-cap">{t("finance.modals.companyAdminCaptainPrepaid.captain")}</Label>
            <select
              id="ca-cap"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={captainId ?? ""}
              onChange={(e) => setCaptainId(e.target.value || null)}
              disabled={captains.isLoading || !captains.data?.items.length}
            >
              {(captains.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {captainOptionLabel(c, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-cap-amount">{t("finance.modals.common.amountIls")}</Label>
            <Input
              id="ca-cap-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
            <p className="text-xs text-muted">{t("finance.modals.common.decimalsHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-cap-reason">{t("finance.modals.common.reason")}</Label>
            <Input
              id="ca-cap-reason"
              name="reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("finance.modals.companyAdminCaptainPrepaid.reasonPlaceholder")}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={charge.isPending || !idempotencyKey}>
              {charge.isPending ? t("finance.modals.common.sending") : t("finance.modals.companyAdminCaptainPrepaid.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
