import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { queryClient } from "@/lib/query-client";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const t = s.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
  companyName?: string | null;
};

export function SuperAdminCompanyTopupModal({ open, onClose, companyId, companyName }: Props) {
  const { t } = useTranslation();
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [currencyInput, setCurrencyInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const topUp = useMutation({
    mutationFn: (vars: { companyId: string; amount: string; reason: string; key: string; currency?: string }) =>
      api.superAdminWallets.topUpCompany(vars.companyId, {
        amount: vars.amount,
        reason: vars.reason,
        idempotencyKey: vars.key,
        ...(vars.currency ? { currency: vars.currency } : {}),
      }),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.companyWalletById(variables.companyId) });
    },
  });

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }
    topUp.reset();
    setIdempotencyKey(crypto.randomUUID());
    setAmountInput("");
    setReasonInput("");
    setCurrencyInput("");
    setFormError(null);
  }, [open, topUp.reset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!companyId) {
      setFormError(t("finance.modals.superAdminCompanyTopup.pickCompany"));
      return;
    }
    if (!idempotencyKey) {
      setFormError(t("finance.modals.common.idempotencyNotReady"));
      return;
    }
    const amount = normalizeAmount(amountInput);
    if (!amount) {
      setFormError(t("finance.modals.common.positiveAmount"));
      return;
    }
    const reason = reasonInput.trim();
    if (reason.length === 0) {
      setFormError(t("finance.modals.superAdminCompanyTopup.chargeReasonRequired"));
      return;
    }
    const cur = currencyInput.trim().toUpperCase();
    void topUp.mutate({
      companyId,
      amount,
      reason,
      key: idempotencyKey,
      ...(cur.length === 3 ? { currency: cur } : {}),
    });
  };

  const serverError = topUp.isError
    ? topUp.error instanceof ApiError
      ? topUp.error.status === 403
        ? t("finance.modals.common.forbidden403")
        : topUp.error.message
      : topUp.error instanceof Error
        ? topUp.error.message
        : t("finance.modals.common.genericCompleteError")
    : null;
  const done = topUp.isSuccess;
  const result = topUp.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("finance.modals.superAdminCompanyTopup.title")}
      description={t("finance.modals.superAdminCompanyTopup.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.superAdminCompanyTopup.successNoop")
              : t("finance.modals.superAdminCompanyTopup.success")}
          </p>
          <div className="space-y-1 text-sm text-muted" dir="ltr">
            <p>
              {t("finance.modals.superAdminCompanyTopup.balanceDelta", {
                before: result.balanceBefore,
                after: result.balanceAfter,
              })}
            </p>
            <p className="text-xs">{t("finance.modals.superAdminCompanyTopup.ledgerEntryLine", { id: result.ledgerEntryId })}</p>
          </div>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted">
            {companyName ? (
              <>
                {t("finance.modals.superAdminCompanyTopup.companyLine", { name: companyName })}
              </>
            ) : companyId ? (
              <>
                {t("finance.modals.superAdminCompanyTopup.companyIdLine")}{" "}
                <span className="font-mono text-xs" dir="ltr">
                  {companyId}
                </span>
              </>
            ) : (
              t("finance.modals.superAdminCompanyTopup.noCompanySelected")
            )}
          </p>
          <div className="space-y-2">
            <Label htmlFor="co-topup-amount">{t("finance.modals.common.amount")}</Label>
            <Input
              id="co-topup-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t("finance.modals.companyAdminStoreTopup.amountPlaceholder")}
            />
            <p className="text-xs text-muted">{t("finance.modals.common.decimalsHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-topup-reason">{t("finance.modals.common.reason")}</Label>
            <Input
              id="co-topup-reason"
              name="reason"
              autoComplete="off"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder={t("finance.modals.superAdminCompanyTopup.reasonPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-topup-currency">{t("finance.modals.superAdminCompanyTopup.currencyOptional")}</Label>
            <Input
              id="co-topup-currency"
              name="currency"
              maxLength={3}
              dir="ltr"
              className="font-mono"
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
              placeholder={t("finance.modals.superAdminCompanyTopup.currencyPlaceholder")}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey || !companyId}>
              {topUp.isPending ? t("finance.modals.common.sending") : t("finance.modals.superAdminCompanyTopup.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
