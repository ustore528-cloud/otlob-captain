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
import { MapPin, Phone, Upload, UserRound } from "lucide-react";

function parseMoneyInput(raw: string): number {
  const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.01;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function hasCoords(lat?: number | null, lng?: number | null): boolean {
  return Number.isFinite(lat ?? NaN) && Number.isFinite(lng ?? NaN);
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
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [packageType, setPackageType] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [locating, setLocating] = useState(false);
  const [dropoffAddressStr, setDropoffAddressStr] = useState("");
  const [pickupLatStr, setPickupLatStr] = useState("");
  const [pickupLngStr, setPickupLngStr] = useState("");
  const [dropoffLatStr, setDropoffLatStr] = useState("");
  const [dropoffLngStr, setDropoffLngStr] = useState("");
  const [receipt, setReceipt] = useState<null | {
    orderNumber: string;
    status: string;
    store: string;
    fee: string;
    collect: string;
    pickupAddress: string;
    dropoffAddress: string;
    captainName: string | null;
    captainPhone: string | null;
    pickupLatitude?: number;
    pickupLongitude?: number;
    dropoffLatitude?: number;
    dropoffLongitude?: number;
  }>(null);

  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);
  const deliveryFeePreview = useMemo(
    () => parseMoneyInput(ctx?.pricing.calculatedDeliveryFee ?? "0").toFixed(2),
    [ctx?.pricing.calculatedDeliveryFee],
  );
  const customerCollectionPreview = useMemo(() => {
    const store = parseMoneyInput(storeAmountStr);
    const fee = parseMoneyInput(deliveryFeePreview);
    return (store + fee).toFixed(2);
  }, [storeAmountStr, deliveryFeePreview]);
  const zoneEligibleCount = useMemo(() => {
    if (!ctx || !selectedZoneId) return null;
    return ctx.captainAvailability.zoneEligibleCounts.find((z) => z.zoneId === selectedZoneId)?.count ?? 0;
  }, [ctx, selectedZoneId]);
  const captainAvailabilityState = useMemo(() => {
    if (loading) return "LOADING";
    if (!ctx) return "NONE";
    if (selectedZoneId && zoneEligibleCount === 0 && ctx.captainAvailability.totalAvailableBikeCaptains > 0) return "BLOCKED";
    if (ctx.captainAvailability.totalAvailableBikeCaptains > 0) return "FOUND";
    return "NONE";
  }, [ctx, loading, selectedZoneId, zoneEligibleCount]);
  const statusTimeline = [
    { key: "PENDING", label: "تم إرسال الطلب" },
    { key: "ASSIGNED", label: "بانتظار قبول الكابتن" },
    { key: "ACCEPTED", label: "تم قبول الطلب" },
    { key: "PICKED_UP", label: "الكابتن في الطريق للاستلام" },
    { key: "IN_TRANSIT", label: "في الطريق للتسليم" },
    { key: "DELIVERED", label: "تم التسليم" },
  ] as const;
  const statusIndex = statusTimeline.findIndex((s) => s.key === receipt?.status);

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
    const feeNum = parseMoneyInput(deliveryFeePreview);
    const packageTypeValue = String(f.get("packageType") ?? "").trim();
    const notesRaw = String(f.get("notes") ?? "").trim();
    const notes = [packageTypeValue ? `نوع الطلب: ${packageTypeValue}` : "", notesRaw].filter(Boolean).join(" | ");
    const pickupLatitude = pickupLatStr.trim() ? Number(pickupLatStr) : undefined;
    const pickupLongitude = pickupLngStr.trim() ? Number(pickupLngStr) : undefined;
    const dropoffLatitude = dropoffLatStr.trim() ? Number(dropoffLatStr) : undefined;
    const dropoffLongitude = dropoffLngStr.trim() ? Number(dropoffLngStr) : undefined;
    setSubmitting(true);
    setErr(null);
    try {
      const created = await createPublicOrder({
        ownerCode: ownerCode.trim(),
        customerName: String(f.get("customerName") ?? "").trim(),
        customerPhone: String(f.get("customerPhone") ?? "").trim(),
        pickupAddress: String(f.get("pickupAddress") ?? "").trim(),
        dropoffAddress: String(f.get("dropoffAddress") ?? "").trim(),
        area: String(f.get("area") ?? "").trim(),
        amount: storeNum,
        notes: notes || undefined,
        ...(Number.isFinite(pickupLatitude) ? { pickupLatitude } : {}),
        ...(Number.isFinite(pickupLongitude) ? { pickupLongitude } : {}),
        ...(Number.isFinite(dropoffLatitude) ? { dropoffLatitude } : {}),
        ...(Number.isFinite(dropoffLongitude) ? { dropoffLongitude } : {}),
        ...(zoneId ? { zoneId } : {}),
      });
      setReceipt({
        orderNumber: created.orderNumber,
        status: created.status,
        store: storeNum.toFixed(2),
        fee: created.deliveryFee ?? feeNum.toFixed(2),
        collect: (storeNum + feeNum).toFixed(2),
        pickupAddress: created.pickupAddress,
        dropoffAddress: created.dropoffAddress,
        captainName: created.assignedCaptain?.user?.fullName ?? null,
        captainPhone: created.assignedCaptain?.user?.phone ?? null,
        ...(Number.isFinite(pickupLatitude) ? { pickupLatitude } : {}),
        ...(Number.isFinite(pickupLongitude) ? { pickupLongitude } : {}),
        ...(Number.isFinite(dropoffLatitude) ? { dropoffLatitude } : {}),
        ...(Number.isFinite(dropoffLongitude) ? { dropoffLongitude } : {}),
      });
      setDone(true);
      e.currentTarget.reset();
      setStoreAmountStr("");
      setSelectedZoneId("");
      setPackageType("");
      setPhotoName("");
      setDropoffAddressStr("");
      setPickupLatStr("");
      setPickupLngStr("");
      setDropoffLatStr("");
      setDropoffLngStr("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("public.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  function fillPickupFromCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const el = document.getElementById("pickupAddress") as HTMLInputElement | null;
        if (el) {
          el.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        }
        setPickupLatStr(pos.coords.latitude.toFixed(6));
        setPickupLngStr(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
        <Card className="border-blue-200 shadow-sm">
          <CardHeader>
            <CardTitle>{t("public.unavailableTitle")}</CardTitle>
            <CardDescription>{err}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done && receipt) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="border-blue-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>{t("public.successTitle")}</CardTitle>
            <CardDescription>{t("public.successDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md border border-card-border bg-muted/30 p-4">
              <p className="font-semibold text-foreground">رقم الطلب: {receipt.orderNumber}</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">{t("public.storeAmount")}:</span> {receipt.store} ₪
                </li>
                <li>
                  <span className="font-medium text-foreground">{t("public.deliveryFee")}:</span> {receipt.fee} ₪
                </li>
                <li>
                  <span className="font-medium text-foreground">{t("public.summaryCollectLabel")}:</span> {receipt.collect} ₪
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                الاستلام: {receipt.pickupAddress}
                <br />
                التسليم: {receipt.dropoffAddress}
              </p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 font-semibold text-blue-900">تتبع الطلب على الخريطة</p>
              {hasCoords(receipt.pickupLatitude, receipt.pickupLongitude) ||
              hasCoords(receipt.dropoffLatitude, receipt.dropoffLongitude) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {hasCoords(receipt.pickupLatitude, receipt.pickupLongitude) ? (
                    <div className="overflow-hidden rounded-lg border border-blue-200 bg-white">
                      <p className="border-b border-blue-100 px-3 py-2 text-xs font-medium text-blue-800">نقطة الاستلام</p>
                      {(() => {
                        const pickupLat = Number(receipt.pickupLatitude);
                        const pickupLng = Number(receipt.pickupLongitude);
                        return (
                      <iframe
                        title="pickup-map"
                        className="h-40 w-full"
                        src={toMapEmbedUrl(pickupLat, pickupLng)}
                        loading="lazy"
                      />
                        );
                      })()}
                    </div>
                  ) : null}
                  {hasCoords(receipt.dropoffLatitude, receipt.dropoffLongitude) ? (
                    <div className="overflow-hidden rounded-lg border border-blue-200 bg-white">
                      <p className="border-b border-blue-100 px-3 py-2 text-xs font-medium text-blue-800">نقطة التسليم</p>
                      {(() => {
                        const dropoffLat = Number(receipt.dropoffLatitude);
                        const dropoffLng = Number(receipt.dropoffLongitude);
                        return (
                      <iframe
                        title="dropoff-map"
                        className="h-40 w-full"
                        src={toMapEmbedUrl(dropoffLat, dropoffLng)}
                        loading="lazy"
                      />
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-blue-200 bg-white p-4 text-xs text-slate-700">
                  <p className="font-medium text-slate-800">خريطة النقاط ستظهر عند توفر الإحداثيات.</p>
                  <p className="mt-1">سيظهر موقع الكابتن عند قبول الطلب.</p>
                </div>
              )}
              <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
                <p className="mb-2 text-xs font-semibold text-blue-900">تسلسل الحالة</p>
                <div className="grid gap-1 text-xs">
                  {statusTimeline.map((step, idx) => (
                    <div key={step.key} className={idx <= statusIndex ? "font-semibold text-blue-800" : "text-slate-500"}>
                      {idx + 1}. {step.label}
                    </div>
                  ))}
                </div>
              </div>
              {receipt.captainName ? (
                <p className="mt-2 text-xs text-slate-700">
                  الكابتن المعيّن: {receipt.captainName}
                  {receipt.captainPhone ? ` — ${receipt.captainPhone}` : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-700">سيظهر موقع الكابتن عند قبول الطلب.</p>
              )}
              <p className="mt-1 text-[11px] text-slate-500">في حال عدم توفر تتبع حي، يتم عرض خريطة نقاط الاستلام/التسليم وحالة الطلب الحالية.</p>
            </div>
            <Button
              type="button"
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setDone(false);
                setReceipt(null);
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
    <div className="mx-auto max-w-4xl p-4 pb-16 sm:p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <Card className="mb-5 border-blue-100 bg-gradient-to-b from-blue-50 to-white shadow-sm">
        <CardHeader>
          <p className="text-sm font-bold tracking-wide text-blue-700">2in</p>
          <CardTitle className="text-2xl font-black text-blue-900">اطلب كابتن الآن</CardTitle>
          <CardDescription className="text-base text-slate-600">
            {ctx?.company.name ? `شركة ${ctx.company.name}` : t("public.cardTitle")} — أرسل طلبك مباشرة ليتم تعيين أقرب كابتن.
          </CardDescription>
        </CardHeader>
      </Card>

      <form className="grid gap-4" onSubmit={onSubmit}>
        {err ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-700">{err}</CardContent>
          </Card>
        ) : null}

        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5 text-blue-600" />
              موقع الاستلام والتسليم
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pickupAddress">{t("public.pickupAddress")}</Label>
              <Input id="pickupAddress" name="pickupAddress" required />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full border-blue-200 text-blue-700"
              onClick={fillPickupFromCurrentLocation}
              disabled={locating}
            >
              {locating ? "جاري تحديد موقعك..." : "استخدام موقعي الحالي"}
            </Button>
            <div className="grid gap-2">
              <Label htmlFor="dropoffAddress">{t("public.dropoffAddress")}</Label>
              <Input
                id="dropoffAddress"
                name="dropoffAddress"
                required
                value={dropoffAddressStr}
                onChange={(e) => setDropoffAddressStr(e.target.value)}
              />
            </div>
            {/* Coordinates remain internal for backend pricing calculations (distance-based). */}
            {ctx && ctx.zones.length > 0 ? (
              <div className="grid gap-2">
                <Label htmlFor="zoneId">{t("public.zoneOptional")}</Label>
                <select
                  id="zoneId"
                  name="zoneId"
                  className={FORM_CONTROL_CLASS}
                  defaultValue=""
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                >
                  <option value="">{t("public.zoneNone")}</option>
                  {ctx.zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.cityName} — {z.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">توفر الكباتن الأقرب</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="text-slate-600">خطة البحث: {ctx?.captainAvailability.radiusPlanKm.join(" كم → ")} كم</p>
            {captainAvailabilityState === "LOADING" ? <p className="text-slate-500">جاري تحميل توفر الكباتن...</p> : null}
            {captainAvailabilityState === "FOUND" ? (
              <p className="text-emerald-700">تم العثور على كباتن متاحين قريبًا. سيتم إرسال الطلب إلى أقرب كابتن متاح.</p>
            ) : null}
            {captainAvailabilityState === "NONE" ? (
              <p className="text-amber-700">لا يوجد كباتن متاحون ضمن 10 كم حاليًا. يمكن إرسال الطلب وسيتم متابعته عند توفر كابتن.</p>
            ) : null}
            {captainAvailabilityState === "BLOCKED" ? (
              <p className="text-amber-700">الكباتن الحاليون غير مؤهلين لمنطقة التوصيل المختارة.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="size-5 text-blue-600" />
              بيانات العميل
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="customerName">{t("public.yourName")}</Label>
              <Input id="customerName" name="customerName" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerPhone" className="flex items-center gap-2">
                <Phone className="size-4 text-blue-600" />
                {t("public.phone")}
              </Label>
              <Input id="customerPhone" name="customerPhone" required dir="ltr" className="text-left" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="packageType">نوع الطرد / الطلب</Label>
              <Input
                id="packageType"
                name="packageType"
                value={packageType}
                onChange={(ev) => setPackageType(ev.target.value)}
                placeholder="مثال: مستندات، وجبة، طرد صغير"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">{t("public.notes")}</Label>
              <Input id="notes" name="notes" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="photo" className="flex items-center gap-2">
                <Upload className="size-4 text-blue-600" />
                صورة المنتج (اختياري)
              </Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(ev) => setPhotoName(ev.target.files?.[0]?.name ?? "")}
              />
              {photoName ? <p className="text-xs text-muted-foreground">تم اختيار: {photoName}</p> : null}
            </div>
          </CardContent>
        </Card>

        <input type="hidden" name="area" value={dropoffAddressStr.trim() || "عام"} />

        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{t("public.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
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
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-blue-900">رسوم التوصيل: {deliveryFeePreview} ₪</p>
              <p className="text-xs text-blue-700">يتم حسابها تلقائيًا حسب إعدادات الشركة</p>
              {ctx?.pricing.mode === "FIXED" ? (
                <p className="mt-1 text-xs text-blue-700">سعر ثابت حسب الشركة</p>
              ) : (
                <p className="mt-1 text-xs text-blue-700">
                  حسب المسافة — السعر الأساسي: {ctx?.pricing.baseDeliveryFee ?? "0.00"} ₪، لكل كم: {ctx?.pricing.pricePerKm ?? "0.00"} ₪
                  {ctx?.pricing.formulaHint ? ` (${ctx.pricing.formulaHint})` : ""}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              <p className="font-semibold text-blue-900">{t("public.previewCollect", { amount: customerCollectionPreview })}</p>
              <p className="text-xs text-blue-700">القيم للعرض فقط، والخادم هو مصدر الحقيقة النهائي لرسوم التوصيل.</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting} className="h-12 bg-blue-600 text-base font-extrabold hover:bg-blue-700">
          {submitting ? t("public.submitting") : "إرسال الطلب"}
        </Button>
      </form>
    </div>
  );
}
