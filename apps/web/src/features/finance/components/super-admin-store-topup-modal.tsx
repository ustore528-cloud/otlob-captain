import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useStores } from "@/hooks/stores/use-stores";
import { api } from "@/lib/api/singleton";
import { ApiError } from "@/lib/api/http";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/api/query-keys";

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
  /** لتهيئة القائمة عند فتح النافذة (مثلاً تبويب المتجر الحالي). */
  defaultStoreId: string | null;
};

export function SuperAdminStoreTopupModal({ open, onClose, defaultStoreId }: Props) {
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
      setFormError("اختر متجراً.");
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
    void topUp.mutate({ storeId, amount, key: idempotencyKey });
  };

  const serverError = topUp.isError
    ? topUp.error instanceof ApiError
      ? topUp.error.message
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
      title="شحن محفظة متجر"
      description="لمدير النظام فقط. يُرسل مفتاح idempotency تلقائياً عند فتح النافذة."
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? "تمت العملية (تسجيل مكرر بأمان — نفس مفتاح idempotency)."
              : "تم شحن رصيد المحفظة."}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            الرصيد الجديد: {result.newBalanceCached}
          </p>
          <Button type="button" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="topup-store">المتجر</Label>
            <select
              id="topup-store"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value || null)}
              disabled={stores.isLoading || !stores.data?.items.length}
            >
              {(stores.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.area}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-amount">المبلغ</Label>
            <Input
              id="topup-amount"
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
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey}>
              {topUp.isPending ? "جارٍ الإرسال…" : "تأكيد الشحن"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
