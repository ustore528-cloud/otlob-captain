import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useStores } from "@/hooks/stores/use-stores";
import { api } from "@/lib/api/singleton";
import { ApiError } from "@/lib/api/http";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import { storeOptionLabel } from "@/i18n/localize-entity-labels";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const t = s.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function mapTopUpError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === "TENANT_SCOPE_REQUIRED") {
      return t("finance.modals.companyAdminStoreTopup.errors.tenantScope");
    }
    if (err.status === 403) {
      return t("finance.modals.companyAdminStoreTopup.errors.storeNotAllowed");
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
  defaultStoreId: string | null;
};

export function CompanyAdminStoreTopupModal({ open, onClose, defaultStoreId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const stores = useStores(1, 100, { enabled: open });

  const topUp = useMutation({
    mutationFn: (vars: { storeId: string; amount: string; reason: string; idempotencyKey: string }) =>
      api.finance.companyAdminTopUpStore(vars.storeId, {
        amount: vars.amount,
        reason: vars.reason,
        idempotencyKey: vars.idempotencyKey,
      }),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.storeWallet(variables.storeId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(result.walletAccountId) });
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
    setReason("");
    setFormError(null);
  }, [open, topUp.reset]);

  useEffect(() => {
    if (!open) return;
    const items = stores.data?.items ?? [];
    if (!items.length) return;
    if (defaultStoreId && items.some((s) => s.id === defaultStoreId)) {
      setStoreId(defaultStoreId);
    } else {
      setStoreId((c) => (c && items.some((s) => s.id === c) ? c : items[0]!.id));
    }
  }, [open, defaultStoreId, stores.data?.items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!storeId) {
      setFormError(t("finance.modals.companyAdminStoreTopup.pickStore"));
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
    void topUp.mutate({ storeId, amount, reason: r, idempotencyKey });
  };

  const serverError = topUp.isError ? mapTopUpError(topUp.error, t) : null;
  const done = topUp.isSuccess;
  const result = topUp.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("finance.modals.companyAdminStoreTopup.title")}
      description={t("finance.modals.companyAdminStoreTopup.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.companyAdminStoreTopup.successNoop")
              : t("finance.modals.companyAdminStoreTopup.success")}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            {t("finance.modals.companyAdminStoreTopup.balanceLine", { value: result.balanceAfter })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ca-topup-store">{t("finance.modals.companyAdminStoreTopup.store")}</Label>
            <select
              id="ca-topup-store"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value || null)}
              disabled={stores.isLoading || !stores.data?.items.length}
            >
              {(stores.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {storeOptionLabel(s, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-topup-amount">{t("finance.modals.common.amountIls")}</Label>
            <Input
              id="ca-topup-amount"
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
            <Label htmlFor="ca-topup-reason">{t("finance.modals.common.reason")}</Label>
            <Input
              id="ca-topup-reason"
              name="reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("finance.modals.companyAdminStoreTopup.reasonPlaceholder")}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey}>
              {topUp.isPending ? t("finance.modals.common.sending") : t("finance.modals.companyAdminStoreTopup.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
