import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api/singleton";
import { ApiError } from "@/lib/api/http";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { UserListItem } from "@/types/api";
import { userListItemNameDisplay } from "@/i18n/localize-entity-labels";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const raw = s.trim();
  if (!AMOUNT_RE.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

const USERS_PAGE = { page: 1, pageSize: 200 } as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Default user when opening the modal, if present in the list. */
  defaultUserId: string | null;
};

type Mode = "increase" | "decrease";

function mergeSupervisorCandidates(
  bm: UserListItem[] | undefined,
  dp: UserListItem[] | undefined,
): UserListItem[] {
  const items = [...(bm ?? []), ...(dp ?? [])];
  const seen = new Set<string>();
  const out: UserListItem[] = [];
  for (const u of items) {
    if (seen.has(u.id)) continue;
    if (u.role !== "BRANCH_MANAGER" && u.role !== "DISPATCHER") continue;
    seen.add(u.id);
    out.push(u);
  }
  out.sort((a, b) => a.fullName.localeCompare(b.fullName, "en"));
  return out;
}

function roleLabel(role: string, t: (k: string) => string): string {
  if (role === "BRANCH_MANAGER") return t("finance.modals.superAdminSupervisorTopup.roles.BRANCH_MANAGER");
  if (role === "DISPATCHER") return t("finance.modals.superAdminSupervisorTopup.roles.DISPATCHER");
  return role;
}

export function SuperAdminSupervisorTopupModal({ open, onClose, defaultUserId }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [mode, setMode] = useState<Mode>("increase");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const usersQueries = useQueries({
    queries: [
      {
        queryKey: queryKeys.users.list({ ...USERS_PAGE, role: "BRANCH_MANAGER" }),
        queryFn: () => api.users.list({ ...USERS_PAGE, role: "BRANCH_MANAGER" }),
        enabled: open,
      },
      {
        queryKey: queryKeys.users.list({ ...USERS_PAGE, role: "DISPATCHER" }),
        queryFn: () => api.users.list({ ...USERS_PAGE, role: "DISPATCHER" }),
        enabled: open,
      },
    ],
  });

  const usersLoading = usersQueries[0]!.isLoading || usersQueries[1]!.isLoading;
  const candidates = useMemo(
    () => mergeSupervisorCandidates(usersQueries[0]!.data?.items, usersQueries[1]!.data?.items),
    [usersQueries[0]!.data?.items, usersQueries[1]!.data?.items],
  );

  const topUp = useMutation({
    mutationFn: (vars: { userId: string; amount: string; note: string; key: string }) =>
      api.superAdminWallets.adjustSupervisorUser(vars.userId, {
        amount: vars.amount,
        note: vars.note,
        idempotencyKey: vars.key,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.supervisorMe() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(result.walletAccountId) });
      void queryClient.invalidateQueries({ queryKey: ["finance", "ledger-activity", result.walletAccountId] });
    },
  });

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }
    topUp.reset();
    setMode("increase");
    setIdempotencyKey(crypto.randomUUID());
    setAmountInput("");
    setNote("");
    setFormError(null);
  }, [open, topUp.reset]);

  useEffect(() => {
    if (!open) return;
    if (!candidates.length) return;
    if (defaultUserId && candidates.some((u) => u.id === defaultUserId)) {
      setUserId(defaultUserId);
    } else {
      setUserId((c) => (c && candidates.some((u) => u.id === c) ? c : candidates[0]!.id));
    }
  }, [open, defaultUserId, candidates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!userId) {
      setFormError(t("finance.modals.superAdminSupervisorTopup.pickUser"));
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
    if (!note.trim()) {
      setFormError(t("finance.modals.common.reasonRequired"));
      return;
    }
    const signedAmount = mode === "increase" ? amount : `-${amount}`;
    void topUp.mutate({ userId, amount: signedAmount, note: note.trim(), key: idempotencyKey });
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
      title={t("finance.modals.superAdminSupervisorTopup.title")}
      description={t("finance.modals.superAdminSupervisorTopup.description")}
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? t("finance.modals.superAdminSupervisorTopup.successNoop")
              : t("finance.modals.superAdminSupervisorTopup.success")}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            {t("finance.modals.superAdminSupervisorTopup.newBalance", { value: result.newBalanceCached })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("finance.modals.common.close")}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="topup-supervisor-user">{t("finance.modals.superAdminSupervisorTopup.userLabel")}</Label>
            <select
              id="topup-supervisor-user"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={userId ?? ""}
              onChange={(e) => setUserId(e.target.value || null)}
              disabled={usersLoading || !candidates.length}
            >
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {userListItemNameDisplay(u, lang)} — {u.phone} ({roleLabel(u.role, t)})
                </option>
              ))}
            </select>
            {candidates.length === 0 && !usersLoading ? (
              <p className="text-xs text-muted">{t("finance.modals.superAdminSupervisorTopup.noUsersHint")}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>{t("finance.modals.superAdminSupervisorTopup.operationType")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={mode === "increase" ? "default" : "secondary"} onClick={() => setMode("increase")}>
                {t("finance.modals.superAdminSupervisorTopup.add")}
              </Button>
              <Button type="button" size="sm" variant={mode === "decrease" ? "default" : "secondary"} onClick={() => setMode("decrease")}>
                {t("finance.modals.superAdminSupervisorTopup.deduct")}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-supervisor-amount">{t("finance.modals.common.amount")}</Label>
            <Input
              id="topup-supervisor-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t("finance.modals.superAdminSupervisorTopup.amountPlaceholder")}
            />
            <p className="text-xs text-muted">{t("finance.modals.superAdminSupervisorTopup.decimalsServerCurrencyHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-supervisor-note">{t("finance.modals.common.reason")}</Label>
            <Input
              id="topup-supervisor-note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("finance.modals.superAdminSupervisorTopup.reasonPlaceholder")}
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("finance.modals.common.cancel")}
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey}>
              {topUp.isPending ? t("finance.modals.common.sending") : t("finance.modals.superAdminSupervisorTopup.confirm")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
