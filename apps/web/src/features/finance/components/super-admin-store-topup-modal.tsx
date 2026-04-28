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
  const raw = s.trim();
  if (!AMOUNT_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Seeds the list when opening the modal (e.g. current store tab). */
  defaultStoreId: string | null;
};

export function SuperAdminStoreTopupModal({ open, onClose, defaultStoreId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const stores = useStores(1, 100, { enabled: open });

  const topUp = useMutation({
    mutationFn: (vars: { storeId: string; amount: string; key: string }) =>
      api.superAdminWallets.topUpStore(vars.storeId, { amount: vars.amount, idempotencyKey: vars.key }),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.storeWallet(variables.storeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(result.walletAccountId) });
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
      setFormError(t("finance.modals.superAdminStoreTopup.pickStore"));
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
    void topUp.mutate({ storeId, amount, key: idempotencyKey });
  };

  const serverError = topUp.isError
    ? topUp.error instanceof ApiError
      ? topUp.error.message
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
      title={t("finance.modals.superAdminStoreTopup.title")}
      description={t("finance.modals.superAdminStoreTopup.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.superAdminStoreTopup.successNoop")
              : t("finance.modals.superAdminStoreTopup.success")}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            {t("finance.modals.superAdminStoreTopup.newBalance", { value: result.newBalanceCached })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="topup-store">{t("finance.modals.superAdminStoreTopup.store")}</Label>
            <select
              id="topup-store"
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
            <Label htmlFor="topup-amount">{t("finance.modals.common.amount")}</Label>
            <Input
              id="topup-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t("finance.modals.superAdminStoreTopup.amountPlaceholder")}
            />
            <p className="text-xs text-muted">{t("finance.modals.common.decimalsHint")}</p>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey}>
              {topUp.isPending ? t("finance.modals.common.sending") : t("finance.modals.superAdminStoreTopup.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
