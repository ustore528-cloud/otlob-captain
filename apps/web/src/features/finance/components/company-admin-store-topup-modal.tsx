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

function mapTopUpError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "TENANT_SCOPE_REQUIRED") {
      return "لا يتوفر نطاق شركة على حسابك (TENANT_SCOPE_REQUIRED). تواصل مع الإدارة لربط الحساب بشركة.";
    }
    if (err.status === 403) {
      return "غير مسموح: المتجر ليس ضمن شركتك أو ليس لديك صلاحية.";
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "تعذّر إكمال الطلب";
}

type Props = {
  open: boolean;
  onClose: () => void;
  defaultStoreId: string | null;
};

export function CompanyAdminStoreTopupModal({ open, onClose, defaultStoreId }: Props) {
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
      setFormError("اختر متجراً.");
      return;
    }
    if (!idempotencyKey) {
      setFormError("مفتاح idempotency غير جاهز. أغلق النافذة وافتحها مرة أخرى.");
      return;
    }
    const r = reason.trim();
    if (!r) {
      setFormError("السبب مطلوب.");
      return;
    }
    const amount = normalizeAmount(amountInput);
    if (!amount) {
      setFormError("أدخل مبلغاً موجباً (حتى رقمين عشريين).");
      return;
    }
    void topUp.mutate({ storeId, amount, reason: r, idempotencyKey });
  };

  const serverError = topUp.isError ? mapTopUpError(topUp.error) : null;
  const done = topUp.isSuccess;
  const result = topUp.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="شحن محفظة متجر (مدير الشركة)"
      description="يُرسل تلقائياً: مفتاح idempotency عند فتح النافذة. نطاق الشركة مأخوذ من جلسة تسجيل الدخول — لا يُرسل معرف الشركة في الطلب."
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? "تمت العملية (تسجيل مكرر بأمان — نفس مفتاح idempotency)."
              : "تم شحن رصيد محفظة المتجر."}
          </p>
          <p className="text-sm text-muted" dir="ltr">
            الرصيد: {result.balanceAfter}
          </p>
          <Button type="button" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ca-topup-store">المتجر</Label>
            <select
              id="ca-topup-store"
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
            <Label htmlFor="ca-topup-amount">المبلغ (ILS)</Label>
            <Input
              id="ca-topup-amount"
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
            <Label htmlFor="ca-topup-reason">السبب</Label>
            <Input
              id="ca-topup-reason"
              name="reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="وصف قصير يظهر في السجلات"
            />
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
