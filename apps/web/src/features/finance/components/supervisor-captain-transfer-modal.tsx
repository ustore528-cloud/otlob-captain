import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const t = s.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

function listSupervisedCaptains(items: CaptainListItem[] | undefined, actorId: string): CaptainListItem[] {
  if (!items?.length) return [];
  return items
    .filter((c) => c.supervisorUser != null && c.supervisorUser.id === actorId)
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName, "ar"));
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** المستخدم المسجّل (مطابقة `Captain.supervisorUserId` في الـ API). */
  actorUserId: string;
  /** اختياري — يُستَخدَم لتهيئة اختيار الكابتن. */
  defaultCaptainId: string | null;
};

export function SupervisorCaptainTransferModal({ open, onClose, actorUserId, defaultCaptainId }: Props) {
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
      setFormError("اختر كابتناً مرتبطاً بك كمشرف.");
      return;
    }
    if (!idempotencyKey) {
      setFormError("مفتاح idempotency غير جاهز. أغلق النافذة وافتحها مرة أخرى.");
      return;
    }
    const amount = normalizeAmount(amountInput);
    if (!amount) {
      setFormError("أدخل مبلغاً موجباً (حتى رقمين عشريين).");
      return;
    }
    void transfer.mutate({ captainId, amount, key: idempotencyKey });
  };

  const serverError = transfer.isError
    ? transfer.error instanceof ApiError
      ? transfer.error.message
      : transfer.error instanceof Error
        ? transfer.error.message
        : "تعذّر إكمال الطلب"
    : null;
  const done = transfer.isSuccess;
  const result = transfer.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تحويل لكابتن"
      description="للمشرف فقط. الكباتن الظاهرون هم المرتبطون بك في النظام. مفتاح idempotency يُولَّد عند فتح النافذة."
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? "تمت العملية (تسجيل مكرر بأمان — نفس مفتاح idempotency)."
              : "تم التحويل."}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            رصيد محفظتك: {result.newFromBalanceCached} — رصيد كابتن: {result.newToBalanceCached}
          </p>
          <Button type="button" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="tx-captain">الكابتن (مرتبط بك فقط)</Label>
            <select
              id="tx-captain"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={captainId ?? ""}
              onChange={(e) => setCaptainId(e.target.value || null)}
              disabled={captains.isLoading || !supervised.length}
            >
              {supervised.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.fullName} — {c.area}
                </option>
              ))}
            </select>
            {supervised.length === 0 && !captains.isLoading ? (
              <p className="text-xs text-muted">لا كباتن مرتبطون بحسابك كمشرف — أو غيّر نطاق القائمة لاحقاً.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-amount">المبلغ</Label>
            <Input
              id="tx-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="مثال: 50 أو 10.00"
            />
            <p className="text-xs text-muted">بدون اختيار عملة. يتطلب نطاق شركتك ووجود رصيد كافٍ.</p>
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={transfer.isPending || !idempotencyKey || !supervised.length}>
              {transfer.isPending ? "جارٍ التحويل…" : "تأكيد التحويل"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
