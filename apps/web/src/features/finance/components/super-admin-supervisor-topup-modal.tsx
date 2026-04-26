import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api/singleton";
import { ApiError } from "@/lib/api/http";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { UserListItem } from "@/types/api";

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function normalizeAmount(s: string): string | null {
  const t = s.trim();
  if (!AMOUNT_RE.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

const USERS_PAGE = { page: 1, pageSize: 200 } as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** يُحدّد المستخدم المختار عند فتح النافذة إن وُجد في القائمة. */
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
  out.sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  return out;
}

function roleLabel(role: string): string {
  if (role === "BRANCH_MANAGER") return "مشرف فرع";
  if (role === "DISPATCHER") return "موزع";
  return role;
}

export function SuperAdminSupervisorTopupModal({ open, onClose, defaultUserId }: Props) {
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
      setFormError("اختر مستخدماً (مشرف فرع أو موزع).");
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
    if (!note.trim()) {
      setFormError("السبب مطلوب.");
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
        : "تعذّر إكمال الطلب"
    : null;
  const done = topUp.isSuccess;
  const result = topUp.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تعديل رصيد المشرف"
      description="لمدير النظام — تعديل رصيد مشرف فرع/موزع بزيادة أو خصم مع سبب إلزامي."
    >
      {done && result ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">
            {result.idempotent
              ? "تمت العملية (تسجيل مكرر بأمان — نفس مفتاح idempotency)."
              : "تم تعديل رصيد المحفظة."}
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
            <Label htmlFor="topup-supervisor-user">المستخدم (مشرف فرع / موزع)</Label>
            <select
              id="topup-supervisor-user"
              className="w-full rounded-md border border-card-border bg-background px-3 py-2 text-sm"
              value={userId ?? ""}
              onChange={(e) => setUserId(e.target.value || null)}
              disabled={usersLoading || !candidates.length}
            >
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {u.phone} ({roleLabel(u.role)})
                </option>
              ))}
            </select>
            {candidates.length === 0 && !usersLoading ? (
              <p className="text-xs text-muted">لا يوجد مستخدمون بهذين الدورين في الصفحة الحالية (زد حجم الصفحة لاحقاً إن لزم).</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>نوع العملية</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={mode === "increase" ? "default" : "secondary"} onClick={() => setMode("increase")}>
                إضافة رصيد
              </Button>
              <Button type="button" size="sm" variant={mode === "decrease" ? "default" : "secondary"} onClick={() => setMode("decrease")}>
                خصم رصيد
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-supervisor-amount">المبلغ</Label>
            <Input
              id="topup-supervisor-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              className="font-mono"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="مثال: 100 أو 10.50"
            />
            <p className="text-xs text-muted">لا يتجاوز رقمان عشريان. بدون اختيار عملة — الافتراضي من الخادم.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topup-supervisor-note">السبب</Label>
            <Input
              id="topup-supervisor-note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="سبب التعديل"
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={topUp.isPending || !idempotencyKey}>
              {topUp.isPending ? "جارٍ الإرسال…" : "تأكيد التعديل"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
