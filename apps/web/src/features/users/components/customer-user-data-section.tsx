import { type FormEvent, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUserCustomerProfile } from "@/hooks";
import type { UserListItem } from "@/types/api";
import type { UpdateCustomerProfilePayload } from "@/lib/api/services/users";

type Props = {
  user: UserListItem;
  canEdit: boolean;
};

function dash(s: string | null | undefined) {
  if (s == null || s === "") return "—";
  return s;
}

export function CustomerUserDataSection({ user: u, canEdit }: Props) {
  const update = useUpdateUserCustomerProfile();
  const [editing, setEditing] = useState(false);
  const [includeMapPin, setIncludeMapPin] = useState(false);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const prevEditing = useRef(false);

  useEffect(() => {
    const entered = editing && !prevEditing.current;
    prevEditing.current = editing;
    if (!entered) return;
    const lat = u.customerDropoffLat;
    const lng = u.customerDropoffLng;
    if (lat != null && lng != null) {
      setIncludeMapPin(true);
      setDropoffCoords({ lat, lng });
    } else {
      setIncludeMapPin(false);
      setDropoffCoords(null);
    }
  }, [editing, u.customerDropoffLat, u.customerDropoffLng]);

  useEffect(() => {
    if (!editing || !includeMapPin) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      return;
    }

    const host = mapHostRef.current;
    if (!host || mapRef.current) return;

    const map = L.map(host, { zoomControl: true }).setView([24.7136, 46.6753], 11);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    requestAnimationFrame(() => map.invalidateSize());

    const seed = dropoffCoords;
    if (seed) {
      map.setView([seed.lat, seed.lng], 15);
      markerRef.current = L.circleMarker([seed.lat, seed.lng], {
        radius: 8,
        color: "#2563eb",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      }).addTo(map);
    }

    map.on("click", (ev) => {
      const lat = Number(ev.latlng.lat.toFixed(6));
      const lng = Number(ev.latlng.lng.toFixed(6));
      setDropoffCoords({ lat, lng });
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(ev.latlng, {
          radius: 8,
          color: "#2563eb",
          weight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.9,
        }).addTo(map);
      } else markerRef.current.setLatLng(ev.latlng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- نقرأ أحدث dropoffCoords عند فتح الخريطة فقط
  }, [editing, includeMapPin]);

  const errorClass = (name: string) => (errors[name] ? "border-red-500 focus-visible:ring-red-300" : "");

  function validate(form: FormData) {
    const next: Record<string, string> = {};
    const locationLink = String(form.get("locationLink") ?? "").trim();
    if (locationLink) {
      try {
        const url = new URL(locationLink);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          next.locationLink = "الرابط يجب أن يبدأ بـ http أو https.";
        }
      } catch {
        next.locationLink = "صيغة الرابط غير صحيحة — الصق الرابط كاملاً.";
      }
    }
    const amountRaw = String(form.get("amount") ?? "").trim();
    const deliveryRaw = String(form.get("delivery") ?? "").trim();
    if (amountRaw && (!Number.isFinite(Number(amountRaw)) || Number(amountRaw) < 0)) {
      next.amount = "سعر الطلب يجب أن يكون رقمًا موجبًا.";
    }
    if (deliveryRaw && (!Number.isFinite(Number(deliveryRaw)) || Number(deliveryRaw) < 0)) {
      next.delivery = "تكلفة التوصيل يجب أن تكون رقمًا موجبًا.";
    }
    if (includeMapPin && !dropoffCoords) {
      next.dropoffCoords = "فعّلت خيار الخريطة — اضغط على الخريطة لتحديد موقع التسليم.";
    }
    return next;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const amountRaw = String(form.get("amount") ?? "").trim();
    const deliveryRaw = String(form.get("delivery") ?? "").trim();
    const locationLink = String(form.get("locationLink") ?? "").trim();

    const body: UpdateCustomerProfilePayload = {
      customerPickupAddress: String(form.get("pickupAddress") ?? "").trim() || null,
      customerDropoffAddress: String(form.get("dropoffAddress") ?? "").trim() || null,
      customerLocationLink: locationLink || null,
      customerArea: String(form.get("area") ?? "").trim() || null,
      customerPreferredAmount: amountRaw ? Number(amountRaw) : null,
      customerPreferredDelivery: deliveryRaw ? Number(deliveryRaw) : null,
      ...(includeMapPin && dropoffCoords
        ? { customerDropoffLat: dropoffCoords.lat, customerDropoffLng: dropoffCoords.lng }
        : { customerDropoffLat: null, customerDropoffLng: null }),
    };

    update.mutate(
      { id: u.id, body },
      {
        onSuccess: () => {
          setEditing(false);
          setErrors({});
        },
      },
    );
  }

  if (u.role !== "CUSTOMER") return null;

  return (
    <div className="mt-3 border-t border-card-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted">بيانات المستخدم العميل</p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        نفس حقول «طلب جديد»: عناوين، رابط موقع، منطقة، أسعار تفضيلية، وخيار تثبيت موقع على الخريطة. يمكن حفظها كمرجع
        لحساب العميل.
      </p>

      {!editing ? (
        <div className="grid gap-2 text-sm">
          <Row label="عنوان الاستلام" value={dash(u.customerPickupAddress)} />
          <Row label="عنوان التسليم" value={dash(u.customerDropoffAddress)} />
          <Row label="رابط الموقع" value={dash(u.customerLocationLink)} mono />
          <Row label="المنطقة" value={dash(u.customerArea)} />
          <Row label="سعر الطلب (تفضيلي)" value={dash(u.customerPreferredAmount)} />
          <Row label="تكلفة التوصيل (تفضيلي)" value={dash(u.customerPreferredDelivery)} />
          {u.customerDropoffLat != null && u.customerDropoffLng != null ? (
            <div dir="ltr" className="text-xs font-mono text-muted">
              إحداثيات محفوظة: {u.customerDropoffLat}, {u.customerDropoffLng}
            </div>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              لا توجد إحداثيات خريطة محفوظة — يمكن للكابتن ضبط الموقع من التطبيق لاحقًا.
            </p>
          )}
          {canEdit ? (
            <Button type="button" size="sm" variant="secondary" className="mt-1 w-full sm:w-auto" onClick={() => setEditing(true)}>
              تعديل البيانات
            </Button>
          ) : null}
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`pickup-${u.id}`}>عنوان الاستلام</Label>
              <Input
                id={`pickup-${u.id}`}
                name="pickupAddress"
                maxLength={500}
                defaultValue={u.customerPickupAddress ?? ""}
                className={errorClass("pickupAddress")}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`dropoff-${u.id}`}>عنوان التسليم</Label>
              <Input
                id={`dropoff-${u.id}`}
                name="dropoffAddress"
                maxLength={500}
                defaultValue={u.customerDropoffAddress ?? ""}
                className={errorClass("dropoffAddress")}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`link-${u.id}`}>لصق رابط الموقع (اختياري)</Label>
              <Input
                id={`link-${u.id}`}
                name="locationLink"
                type="url"
                inputMode="url"
                placeholder="https://maps.app.goo.gl/..."
                maxLength={2000}
                dir="ltr"
                defaultValue={u.customerLocationLink ?? ""}
                className={`text-left ${errorClass("locationLink")}`}
              />
              {errors.locationLink ? <p className="text-xs text-red-600">{errors.locationLink}</p> : null}
              <p className="text-xs text-muted">
                الصق رابط المشاركة من خرائط جوجل أو أي رابط https يوضح موقع التسليم؛ يُحفظ للكابتن مع الطلب عند
                الاستخدام.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`area-${u.id}`}>المنطقة</Label>
              <Input id={`area-${u.id}`} name="area" maxLength={200} defaultValue={u.customerArea ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`amount-${u.id}`}>سعر الطلب (تفضيلي)</Label>
              <Input
                id={`amount-${u.id}`}
                name="amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={u.customerPreferredAmount ?? ""}
                className={errorClass("amount")}
              />
              {errors.amount ? <p className="text-xs text-red-600">{errors.amount}</p> : null}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`delivery-${u.id}`}>تكلفة التوصيل (تفضيلي)</Label>
              <Input
                id={`delivery-${u.id}`}
                name="delivery"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                defaultValue={u.customerPreferredDelivery ?? ""}
                className={errorClass("delivery")}
              />
              {errors.delivery ? <p className="text-xs text-red-600">{errors.delivery}</p> : null}
            </div>

            <div className="grid gap-3 sm:col-span-2">
              {!includeMapPin ? (
                <div
                  className="rounded-xl border border-dashed border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100"
                  role="status"
                >
                  <p className="font-medium">لم يُحدَّد موقع على الخريطة</p>
                  <p className="mt-1 text-xs opacity-90">
                    يمكن للكابتن تأكيد أو ضبط موقع التسليم من تطبيق الكابتن عند الحاجة. لتثبيت موقع الآن، فعّل الخيار
                    أدناه.
                  </p>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-card-border bg-background/50 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 rounded border-card-border"
                  checked={includeMapPin}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setIncludeMapPin(on);
                    if (!on) setDropoffCoords(null);
                    setErrors((prev) => {
                      const { dropoffCoords: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                />
                <span className="text-sm leading-snug">
                  <span className="font-medium">إضافة موقع التسليم على الخريطة (اختياري)</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    عند التفعيل، اضغط على الخريطة لتثبيت نقطة التسليم وحفظ الإحداثيات مع بيانات العميل.
                  </span>
                </span>
              </label>

              {includeMapPin ? (
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">خريطة تثبيت موقع التسليم</Label>
                  <div
                    ref={mapHostRef}
                    className={`h-56 w-full overflow-hidden rounded-xl border ${errors.dropoffCoords ? "border-red-500" : "border-card-border"}`}
                  />
                  <p className="text-xs text-muted">اضغط على الخريطة لتثبيت موقع التسليم.</p>
                  {errors.dropoffCoords ? <p className="text-xs text-red-600">{errors.dropoffCoords}</p> : null}
                  {dropoffCoords ? (
                    <div dir="ltr" className="text-xs font-mono text-muted">
                      lat: {dropoffCoords.lat}, lng: {dropoffCoords.lng}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)}>
              إلغاء
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <div className={`mt-0.5 ${mono ? "break-all font-mono text-xs" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}
