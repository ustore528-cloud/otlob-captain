import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { createPublicOrder, getPublicRequestContext, type PublicRequestContext } from "@/lib/api/services/public-request";
import { ApiError } from "@/lib/api/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { LanguageSwitcher } from "@/components/language-switcher";
import { isRtlLang } from "@/i18n/i18n";

function parseMoneyInput(raw: string): number {
  const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function PublicRequestPage() {
  const { t, i18n } = useTranslation();
  const { ownerCode } = useParams<{ ownerCode: string }>();
  const [ctx, setCtx] = useState<PublicRequestContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [storeAmountStr, setStoreAmountStr] = useState("");
  const [deliveryFeeStr, setDeliveryFeeStr] = useState("0");
  const [lastReceipt, setLastReceipt] = useState<{
    store: string;
    fee: string;
    collect: string;
  } | null>(null);

  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);

  const customerCollectionPreview = useMemo(() => {
    const store = parseMoneyInput(storeAmountStr);
    const fee = parseMoneyInput(deliveryFeeStr);
    return (store + fee).toFixed(2);
  }, [storeAmountStr, deliveryFeeStr]);

  useEffect(() => {
    if (!ownerCode?.trim()) {
      setErr(t("public.invalidLink"));
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await getPublicRequestContext(ownerCode.trim());
        if (!cancelled) {
          setCtx(data);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : t("public.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerCode, t]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ownerCode?.trim() || !ctx) return;
    const f = new FormData(e.currentTarget);
    const zoneId = String(f.get("zoneId") ?? "").trim();
    const storeNum = parseMoneyInput(storeAmountStr);
    const feeNum = parseMoneyInput(deliveryFeeStr);
    setSubmitting(true);
    setErr(null);
    try {
      await createPublicOrder({
        ownerCode: ownerCode.trim(),
        customerName: String(f.get("customerName") ?? "").trim(),
        customerPhone: String(f.get("customerPhone") ?? "").trim(),
        pickupAddress: String(f.get("pickupAddress") ?? "").trim(),
        dropoffAddress: String(f.get("dropoffAddress") ?? "").trim(),
        area: String(f.get("area") ?? "").trim(),
        amount: storeNum,
        deliveryFee: feeNum,
        notes: String(f.get("notes") ?? "").trim() || undefined,
        ...(zoneId ? { zoneId } : {}),
      });
      setLastReceipt({
        store: storeNum.toFixed(2),
        fee: feeNum.toFixed(2),
        collect: (storeNum + feeNum).toFixed(2),
      });
      setDone(true);
      e.currentTarget.reset();
      setStoreAmountStr("");
      setDeliveryFeeStr("0");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("public.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-muted-foreground">{t("public.loading")}</p>
      </div>
    );
  }

  if (err && !ctx) {
    return (
      <div className="mx-auto max-w-lg p-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("public.unavailableTitle")}</CardTitle>
            <CardDescription>{err}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg p-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("public.successTitle")}</CardTitle>
            <CardDescription>{t("public.successDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastReceipt ? (
              <div className="rounded-md border border-card-border bg-muted/30 p-4 text-sm">
                <p className="mb-2 font-semibold text-foreground">{t("public.summaryTitle")}</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">{t("public.storeAmount")}:</span> {lastReceipt.store} ₪
                  </li>
                  <li>
                    <span className="font-medium text-foreground">{t("public.deliveryFee")}:</span> {lastReceipt.fee} ₪
                  </li>
                  <li>
                    <span className="font-medium text-foreground">{t("public.summaryCollectLabel")}:</span>{" "}
                    {lastReceipt.collect} ₪
                  </li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">{t("public.summaryNote")}</p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDone(false);
                setLastReceipt(null);
              }}
            >
              {t("public.newRequest")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-4 pb-16 sm:p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("public.cardTitle")}</CardTitle>
          <CardDescription>
            {ctx?.company.name} — {ctx?.companyAdmin.fullName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err ? <p className="mb-4 text-sm text-destructive">{err}</p> : null}
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="customerName">{t("public.yourName")}</Label>
              <Input id="customerName" name="customerName" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerPhone">{t("public.phone")}</Label>
              <Input id="customerPhone" name="customerPhone" required dir="ltr" className="text-left" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pickupAddress">{t("public.pickupAddress")}</Label>
              <Input id="pickupAddress" name="pickupAddress" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dropoffAddress">{t("public.dropoffAddress")}</Label>
              <Input id="dropoffAddress" name="dropoffAddress" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="area">{t("public.area")}</Label>
              <Input id="area" name="area" required />
            </div>
            {ctx && ctx.zones.length > 0 ? (
              <div className="grid gap-2">
                <Label htmlFor="zoneId">{t("public.zoneOptional")}</Label>
                <select id="zoneId" name="zoneId" className={FORM_CONTROL_CLASS} defaultValue="">
                  <option value="">{t("public.zoneNone")}</option>
                  {ctx.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.cityName} — {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="amount">{t("public.storeAmount")}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                required
                dir="ltr"
                className="text-left"
                value={storeAmountStr}
                onChange={(ev) => setStoreAmountStr(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliveryFee">{t("public.deliveryFee")}</Label>
              <Input
                id="deliveryFee"
                name="deliveryFee"
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                className="text-left"
                value={deliveryFeeStr}
                onChange={(ev) => setDeliveryFeeStr(ev.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("public.previewCollect", { amount: customerCollectionPreview })}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t("public.notes")}</Label>
              <Input id="notes" name="notes" />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("public.submitting") : t("public.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
