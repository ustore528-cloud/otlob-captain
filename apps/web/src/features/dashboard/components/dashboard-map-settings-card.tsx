import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardMapPicker, type DashboardMapPickerHandle } from "./dashboard-map-picker";
import { resolveDashboardMapView } from "@/features/distribution/map-default-view";
import { useDashboardSettings, useUpdateDashboardSettings } from "@/hooks";
import { api } from "@/lib/api/singleton";
import { clampLatLng, ISRAEL_MAP_DEFAULT_CENTER, ISRAEL_MAP_DEFAULT_ZOOM } from "@/lib/israel-map-bounds";
import type { DashboardSettingsDto } from "@/types/api";

function applyDto(d: DashboardSettingsDto) {
  const v = resolveDashboardMapView(d);
  return {
    mapCountry: d.mapCountry ?? "",
    mapCityRegion: d.mapCityRegion ?? "",
    latitude: v.center[0],
    longitude: v.center[1],
    zoom: v.zoom,
  };
}

export function DashboardMapSettingsCard() {
  const settings = useDashboardSettings();
  const update = useUpdateDashboardSettings();
  const pickerRef = useRef<DashboardMapPickerHandle>(null);

  const [mapCountry, setMapCountry] = useState("");
  const [mapCityRegion, setMapCityRegion] = useState("");
  const [latitude, setLatitude] = useState(ISRAEL_MAP_DEFAULT_CENTER[0]);
  const [longitude, setLongitude] = useState(ISRAEL_MAP_DEFAULT_CENTER[1]);
  const [zoom, setZoom] = useState(ISRAEL_MAP_DEFAULT_ZOOM);
  const [prepaidCaptainsEnabled, setPrepaidCaptainsEnabled] = useState(false);
  const [prepaidDefaultCommissionPercent, setPrepaidDefaultCommissionPercent] = useState("15");
  const [prepaidAllowCaptainCustomCommission, setPrepaidAllowCaptainCustomCommission] = useState(true);
  const [prepaidMinimumBalanceToReceiveOrders, setPrepaidMinimumBalanceToReceiveOrders] = useState("0");
  const [prepaidAllowManualAssignmentOverride, setPrepaidAllowManualAssignmentOverride] = useState(false);

  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);

  const initialized = useRef(false);
  useEffect(() => {
    if (!settings.data || initialized.current) return;
    initialized.current = true;
    const next = applyDto(settings.data);
    setMapCountry(next.mapCountry);
    setMapCityRegion(next.mapCityRegion);
    setLatitude(next.latitude);
    setLongitude(next.longitude);
    setZoom(next.zoom);
    setPrepaidCaptainsEnabled(Boolean(settings.data.prepaidCaptainsEnabled));
    setPrepaidDefaultCommissionPercent(String(settings.data.prepaidDefaultCommissionPercent ?? "15"));
    setPrepaidAllowCaptainCustomCommission(Boolean(settings.data.prepaidAllowCaptainCustomCommission));
    setPrepaidMinimumBalanceToReceiveOrders(String(settings.data.prepaidMinimumBalanceToReceiveOrders ?? "0"));
    setPrepaidAllowManualAssignmentOverride(Boolean(settings.data.prepaidAllowManualAssignmentOverride));
  }, [settings.data]);

  const onViewChange = useCallback((next: { latitude: number; longitude: number; zoom: number }) => {
    setGeocodeHint(null);
    const cl = clampLatLng(next.latitude, next.longitude);
    setLatitude(cl.lat);
    setLongitude(cl.lng);
    setZoom(next.zoom);
  }, []);

  const onGeocodeSearch = useCallback(async () => {
    setGeocodeError(null);
    setGeocodeHint(null);
    const c = mapCountry.trim();
    const t = mapCityRegion.trim();
    if (!c && !t) {
      setGeocodeError("أدخل دولة أو مدينة أو كليهما ثم اضغط بحث.");
      return;
    }
    setGeocodeLoading(true);
    try {
      const r = await api.geocode.place({ country: c || null, city: t || null });
      if (r == null || typeof r.lat !== "number" || typeof r.lng !== "number" || typeof r.zoom !== "number") {
        setGeocodeError("استجابة غير كاملة من الخادم — حاول مجدداً أو حرّك الخريطة يدوياً.");
        return;
      }
      const cl = clampLatLng(r.lat, r.lng);
      setLatitude(cl.lat);
      setLongitude(cl.lng);
      setZoom(r.zoom);
      const label = r.displayName?.trim() || "";
      const short = label.length > 120 ? `${label.slice(0, 120)}…` : label;
      setGeocodeHint(label ? `تم التموضع: ${short}` : "تم تحديث الإحداثيات والتكبير.");
    } catch (e) {
      setGeocodeHint(null);
      setGeocodeError((e as Error)?.message ?? "تعذر البحث عن الموقع.");
    } finally {
      setGeocodeLoading(false);
    }
  }, [mapCountry, mapCityRegion]);

  const onSave = () => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) return;
    const cl = clampLatLng(latitude, longitude);
    const zi = Math.round(zoom);
    if (zi < 1 || zi > 19) return;
    const commission = Number(prepaidDefaultCommissionPercent);
    const minBalance = Number(prepaidMinimumBalanceToReceiveOrders);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) return;
    if (!Number.isFinite(minBalance) || minBalance < 0) return;
    update.mutate(
      {
        mapCountry: mapCountry.trim() || null,
        mapCityRegion: mapCityRegion.trim() || null,
        mapDefaultLat: cl.lat,
        mapDefaultLng: cl.lng,
        mapDefaultZoom: zi,
        prepaidCaptainsEnabled,
        prepaidDefaultCommissionPercent: commission,
        prepaidAllowCaptainCustomCommission,
        prepaidMinimumBalanceToReceiveOrders: minBalance,
        prepaidAllowManualAssignmentOverride,
      },
      {
        onSuccess: (data) => {
          const next = applyDto(data);
          setMapCountry(next.mapCountry);
          setMapCityRegion(next.mapCityRegion);
          setLatitude(next.latitude);
          setLongitude(next.longitude);
          setZoom(next.zoom);
        },
      },
    );
  };

  const loading = settings.isLoading;

  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 opacity-80" />
          إعدادات الخريطة
        </CardTitle>
        <p className="text-sm text-muted">
          الإحداثيات والتكبير يُحفظان في الخادم. الدولة والمدينة تُستخدمان للبحث الجغرافي (Nominatim) لتحريك الخريطة — يمكنك
          أيضاً ضبط الموقع يدوياً على الخريطة.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 [direction:rtl]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-map-country">الدولة</Label>
            <Input
              id="dashboard-map-country"
              name="mapCountry"
              placeholder="مثال: السعودية"
              value={mapCountry}
              onChange={(e) => {
                setMapCountry(e.target.value);
                setGeocodeError(null);
              }}
              disabled={loading}
              list="dashboard-map-country-suggestions"
              autoComplete="country-name"
            />
            <datalist id="dashboard-map-country-suggestions">
              <option value="السعودية" />
              <option value="مصر" />
              <option value="الإمارات" />
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-map-city">المدينة / المنطقة</Label>
            <Input
              id="dashboard-map-city"
              name="mapCityRegion"
              placeholder="مثال: الرياض"
              value={mapCityRegion}
              onChange={(e) => {
                setMapCityRegion(e.target.value);
                setGeocodeError(null);
              }}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading || geocodeLoading}
            onClick={() => void onGeocodeSearch()}
          >
            <Search className="size-4 opacity-90" />
            {geocodeLoading ? "جاري البحث…" : "بحث وتحريك الخريطة"}
          </Button>
          <span className="text-[11px] text-muted">
            يدعم: دولة فقط، مدينة فقط، أو دولة + مدينة. البحث عبر{" "}
            <span dir="ltr" className="font-mono text-[10px]">
              Nominatim
            </span>{" "}
            (OpenStreetMap).
          </span>
        </div>
        {geocodeError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {geocodeError}
          </p>
        ) : null}
        {geocodeHint && !geocodeError ? <p className="text-xs text-muted">{geocodeHint}</p> : null}

        <div className="grid gap-2">
          <p className="text-sm font-medium">اختيار على الخريطة</p>
          <p className="text-xs text-muted">حرّك الخريطة، كبّر/صغّر، أو انقر لتحديد المركز. تُحدَّث الإحداثيات والتكبير تلقائياً.</p>
          <DashboardMapPicker
            ref={pickerRef}
            latitude={latitude}
            longitude={longitude}
            zoom={zoom}
            onViewChange={onViewChange}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => pickerRef.current?.syncFromMap()}
            >
              استخدم مركز الخريطة الحالي
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-map-lat">خط العرض</Label>
            <Input
              id="dashboard-map-lat"
              inputMode="decimal"
              dir="ltr"
              className="font-mono tabular-nums"
              value={Number.isFinite(latitude) ? String(latitude) : ""}
              onChange={(e) => {
                const t = e.target.value;
                if (t === "" || t === "-") return;
                const n = Number.parseFloat(t);
                if (Number.isFinite(n)) setLatitude(n);
              }}
              disabled={loading}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-map-lng">خط الطول</Label>
            <Input
              id="dashboard-map-lng"
              inputMode="decimal"
              dir="ltr"
              className="font-mono tabular-nums"
              value={Number.isFinite(longitude) ? String(longitude) : ""}
              onChange={(e) => {
                const t = e.target.value;
                if (t === "" || t === "-") return;
                const n = Number.parseFloat(t);
                if (Number.isFinite(n)) setLongitude(n);
              }}
              disabled={loading}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dashboard-map-zoom">التكبير (1–19)</Label>
            <Input
              id="dashboard-map-zoom"
              inputMode="numeric"
              dir="ltr"
              className="font-mono tabular-nums"
              value={Number.isFinite(zoom) ? String(zoom) : ""}
              onChange={(e) => {
                const t = e.target.value;
                if (t === "") return;
                const n = Number.parseInt(t, 10);
                if (!Number.isNaN(n)) setZoom(n);
              }}
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-card-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold">نظام رصيد الكباتن المدفوع مسبقًا</h3>
            <p className="mt-1 text-xs text-muted">يتم الخصم من رسوم التوصيل فقط بعد تسليم الطلب.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prepaidCaptainsEnabled}
              onChange={(e) => setPrepaidCaptainsEnabled(e.target.checked)}
            />
            تفعيل نظام الرصيد
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="prepaid-default-commission">نسبة العمولة الافتراضية</Label>
              <Input
                id="prepaid-default-commission"
                inputMode="decimal"
                dir="ltr"
                value={prepaidDefaultCommissionPercent}
                onChange={(e) => setPrepaidDefaultCommissionPercent(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prepaid-min-balance">الحد الأدنى لاستقبال طلبات</Label>
              <Input
                id="prepaid-min-balance"
                inputMode="decimal"
                dir="ltr"
                value={prepaidMinimumBalanceToReceiveOrders}
                onChange={(e) => setPrepaidMinimumBalanceToReceiveOrders(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prepaidAllowCaptainCustomCommission}
              onChange={(e) => setPrepaidAllowCaptainCustomCommission(e.target.checked)}
            />
            السماح بنسبة عمولة خاصة لكل كابتن
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prepaidAllowManualAssignmentOverride}
              onChange={(e) => setPrepaidAllowManualAssignmentOverride(e.target.checked)}
            />
            السماح بتجاوز التعيين اليدوي عند انخفاض الرصيد
          </label>
        </div>

        {update.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{(update.error as Error)?.message ?? "تعذّر الحفظ"}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onSave} disabled={loading || update.isPending}>
            {update.isPending ? "جاري الحفظ…" : "حفظ إعدادات الخريطة"}
          </Button>
          {settings.data?.updatedAt ? (
            <span className="text-xs text-muted" title={settings.data.updatedAt}>
              آخر تحديث: {new Date(settings.data.updatedAt).toLocaleString("ar-SA")}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
