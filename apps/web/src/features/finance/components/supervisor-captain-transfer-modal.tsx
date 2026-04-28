import { useEffect, useMemo, useState } from "react";
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
import type { CaptainListItem } from "@/types/api";
import { captainOptionLabel } from "@/i18n/localize-entity-labels";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const raw = s.trim();
  if (!AMOUNT_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function listSupervisedCaptains(items: CaptainListItem[] | undefined, actorId: string): CaptainListItem[] {
  if (!items?.length) return [];
  return items
    .filter((c) => c.supervisorUser != null && c.supervisorUser.id === actorId)
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName, "en"));
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Logged-in user id (matches `Captain.supervisorUserId` from the API). */
  actorUserId: string;
  /** Optional — used to initialize captain selection. */
  defaultCaptainId: string | null;
};

export function SupervisorCaptainTransferModal({ open, onClose, actorUserId, defaultCaptainId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const captains = useCaptains(
    { page: 1, pageSize: 200 },
    { enabled: open },
  );

  const supervised = useMemo(
    () => listSupervisedCaptains(captains.data?.items, actorUserId),
    [actorUserId, captains.data?.items],
  );

  const transfer = useMutation({
    mutationFn: (vars: { captainId: string; amount: string; key: string }) =>
      api.supervisorWallets.transferToCaptain({
        captainId: vars.captainId,
        amount: vars.amount,
        idempotencyKey: vars.key,
      }),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.supervisorMe() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.captainWallet(variables.captainId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(data.fromWalletAccountId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(data.toWalletAccountId) });
    },
  });

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }
    transfer.reset();
    setIdempotencyKey(crypto.randomUUID());
    setAmountInput("");
    setFormError(null);
  }, [open, transfer.reset]);

  useEffect(() => {
    if (!open) return;
    if (!supervised.length) {
      setCaptainId(null);
      return;
    }
    if (defaultCaptainId && supervised.some((c) => c.id === defaultCaptainId)) {
      setCaptainId(defaultCaptainId);
    } else {
      setCaptainId((c) => (c && supervised.some((x) => x.id === c) ? c : supervised[0]!.id));
    }
  }, [open, defaultCaptainId, supervised]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!captainId) {
      setFormError(t("finance.modals.supervisorCaptainTransfer.pickCaptain"));
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
    void transfer.mutate({ captainId, amount, key: idempotencyKey });
  };

  const serverError = transfer.isError
    ? transfer.error instanceof ApiError
      ? transfer.error.message
      : transfer.error instanceof Error
        ? transfer.error.message
        : t("finance.modals.common.genericCompleteError")
    : null;
  const done = transfer.isSuccess;
  const result = transfer.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("finance.modals.supervisorCaptainTransfer.title")}
      description={t("finance.modals.supervisorCaptainTransfer.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.supervisorCaptainTransfer.successNoop")
              : t("finance.modals.supervisorCaptainTransfer.success")}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            {t("finance.modals.supervisorCaptainTransfer.balancesLine", {
              from: result.newFromBalanceCached,
              to: result.newToBalanceCached,
            })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="tx-captain">{t("finance.modals.supervisorCaptainTransfer.captainLabel")}</Label>
            <select
              id="tx-captain"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={captainId ?? ""}
              onChange={(e) => setCaptainId(e.target.value || null)}
              disabled={captains.isLoading || !supervised.length}
            >
              {supervised.map((c) => (
                <option key={c.id} value={c.id}>
                  {captainOptionLabel(c, lang)}
                </option>
              ))}
            </select>
            {supervised.length === 0 && !captains.isLoading ? (
              <p className="text-xs text-muted">{t("finance.modals.supervisorCaptainTransfer.noCaptainsHint")}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-amount">{t("finance.modals.common.amount")}</Label>
            <Input
              id="tx-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t("finance.modals.supervisorCaptainTransfer.amountPlaceholder")}
            />
            <p className="text-xs text-muted">{t("finance.modals.supervisorCaptainTransfer.currencyHint")}</p>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={transfer.isPending || !idempotencyKey || !supervised.length}>
              {transfer.isPending ? t("finance.modals.common.transferring") : t("finance.modals.supervisorCaptainTransfer.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
