import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateOrder, useStores } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";

export function NewOrderPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState("");

  const stores = useStores(1, 200);
  const create = useCreateOrder();

  const storeOptions = stores.data?.items ?? [];
  const lockedStoreId = user?.role === "STORE" ? user.storeId : null;

  useEffect(() => {
    if (lockedStoreId) setStoreId(lockedStoreId);
  }, [lockedStoreId]);

  const selectedStore = useMemo(() => storeOptions.find((s) => s.id === storeId), [storeOptions, storeId]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sid = lockedStoreId ?? String(form.get("storeId") ?? "");
    if (!sid) return;
    create.mutate(
      {
        storeId: sid,
        customerName: String(form.get("customerName") ?? "").trim(),
        customerPhone: String(form.get("customerPhone") ?? "").trim(),
        pickupAddress: String(form.get("pickupAddress") ?? "").trim(),
        dropoffAddress: String(form.get("dropoffAddress") ?? "").trim(),
        area: String(form.get("area") ?? "").trim(),
        amount: Number(form.get("amount") ?? 0),
        cashCollection: form.get("cashCollection") ? Number(form.get("cashCollection")) : undefined,
        notes: String(form.get("notes") ?? "").trim() || undefined,
        distributionMode: "AUTO",
      },
      {
        onSuccess: () => void navigate("/orders"),
      },
    );
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title="طلب جديد"
        description="يرتبط الطلب بالمتجر عبر المعرّف الداخلي؛ يعرض النموذج اسم المتجر وهاتفه للتوضيح فقط."
      />

      <form className="grid gap-6 rounded-2xl border border-card-border bg-card p-6 shadow-sm" onSubmit={onSubmit}>
        {user?.role === "STORE" ? (
          <div className="grid gap-2">
            <Label>المتجر</Label>
            <Input readOnly value={user.storeId ? "متجرك المسجّل" : "—"} className="bg-accent/40" />
            <p className="text-xs text-muted">يتم إنشاء الطلب تلقائيًا لمتجر حسابك.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="storeId">المتجر</Label>
            <select
              id="storeId"
              name="storeId"
              required
              className="h-10 w-full rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">— اختر المتجر —</option>
              {stores.isLoading ? (
                <option disabled>جارٍ التحميل…</option>
              ) : (
                storeOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.phone}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {selectedStore ? (
          <div className="grid gap-1 rounded-xl border border-card-border bg-background/50 px-4 py-3 text-sm">
            <div>
              <span className="text-muted">اسم المتجر: </span>
              <span className="font-medium">{selectedStore.name}</span>
            </div>
            <div dir="ltr" className="text-left">
              <span className="text-muted">هاتف المتجر: </span>
              <span className="font-mono">{selectedStore.phone}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="customerName">اسم العميل</Label>
            <Input id="customerName" name="customerName" required maxLength={200} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="customerPhone">هاتف العميل</Label>
            <Input id="customerPhone" name="customerPhone" required dir="ltr" className="text-left" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="pickupAddress">عنوان الاستلام</Label>
            <Input id="pickupAddress" name="pickupAddress" required maxLength={500} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="dropoffAddress">عنوان التسليم</Label>
            <Input id="dropoffAddress" name="dropoffAddress" required maxLength={500} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="area">المنطقة</Label>
            <Input
              key={storeId || "area"}
              id="area"
              name="area"
              required
              maxLength={200}
              defaultValue={selectedStore?.area}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">المبلغ</Label>
            <Input id="amount" name="amount" type="number" inputMode="decimal" min={0} step="0.01" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cashCollection">تحصيل نقدي (اختياري)</Label>
            <Input id="cashCollection" name="cashCollection" type="number" inputMode="decimal" min={0} step="0.01" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" name="notes" maxLength={2000} rows={3} />
          </div>
        </div>

        {stores.isError ? <p className="text-sm text-red-600">{(stores.error as Error).message}</p> : null}
        {create.isError ? <p className="text-sm text-red-600">{(create.error as Error).message}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void navigate(-1)}>
            رجوع
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "جارٍ الإنشاء…" : "إنشاء الطلب"}
          </Button>
        </div>
      </form>
    </div>
  );
}
