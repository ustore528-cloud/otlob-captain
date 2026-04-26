import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
      setFormError("اختر شركة أولاً من التبويب.");
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
    const reason = reasonInput.trim();
    if (reason.length === 0) {
      setFormError("سبب الشحن مطلوب.");
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
        ? "غير مسموح بهذه العملية (403)."
        : topUp.error.message
      : topUp.error instanceof Error
        ? topUp.error.message
        : "تعذّر إكمال الطلب"
    : null;
  const done = topUp.isSuccess;
  const result = topUp.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="شحن محفظة الشركة"
      description="لمدير النظام فقط. يُولَّد مفتاح idempotency تلقائياً عند فتح النافذة ويُرسل في جسم الطلب."
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? "تمت العملية (تسجيل مكرر بأمان — نفس مفتاح idempotency في الجسم)."
              : "تم شحن رصيد محفظة الشركة."}
          </p>
          <div className="space-y-1 text-sm text-muted" dir="ltr">
            <p>
              قبل: {result.balanceBefore} ← بعد: {result.balanceAfter}
            </p>
            <p className="text-xs">ledger: {result.ledgerEntryId}</p>
          </div>
          <Button type="button" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted">
            {companyName ? (
              <>
                الشركة: <span className="font-medium text-foreground">{companyName}</span>
              </>
            ) : companyId ? (
              <>
                معرّف الشركة: <span className="font-mono text-xs" dir="ltr">
                  {companyId}
                </span>
              </>
            ) : (
              "لم تُختر شركة — أغلق واختر شركة من التبويب أولاً."
            )}
          </p>
          <div className="space-y-2">
            <Label htmlFor="co-topup-amount">المبلغ</Label>
            <Input
              id="co-topup-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="مثال: 100 أو 10.50"
            />
            <p className="text-xs text-muted">لا يتجاوز رقمان عشريان.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-topup-reason">السبب</Label>
            <Input
              id="co-topup-reason"
              name="reason"
              autoComplete="off"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="مثال: تمويل رصيد طلبات"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-topup-currency">العملة (اختياري، 3 أحرف)</Label>
            <Input
              id="co-topup-currency"
              name="currency"
              maxLength={3}
              dir="ltr"
              className="font-mono"
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
              placeholder="SAR (افتراضي الخادم إن وُجد)"
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey || !companyId}>
              {topUp.isPending ? "جارٍ الإرسال…" : "تأكيد الشحن"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
