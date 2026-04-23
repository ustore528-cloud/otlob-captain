import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateOrder } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isStoreAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export function NewOrderForm() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [includeMapPin, setIncludeMapPin] = useState(false);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const create = useCreateOrder();

  const lockedStoreId = isStoreAdminRole(user?.role) ? user?.storeId ?? null : null;

  useEffect(() => {
    if (!includeMapPin) {
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
  }, [includeMapPin]);

  const errorClass = (name: string) =>
    errors[name] ? "border-red-500 focus-visible:ring-red-300" : "";

  function validate(form: FormData) {
    const next: Record<string, string> = {};
    const customerName = String(form.get("customerName") ?? "").trim();
    const customerPhone = String(form.get("customerPhone") ?? "").trim();
    const pickupAddress = String(form.get("pickupAddress") ?? "").trim();
    const dropoffAddress = String(form.get("dropoffAddress") ?? "").trim();
    const area = String(form.get("area") ?? "").trim();
    const amount = Number(form.get("amount") ?? 0);
    const cashCollectionRaw = String(form.get("cashCollection") ?? "").trim();
    const cashCollection = cashCollectionRaw ? Number(cashCollectionRaw) : undefined;
    const locationLink = String(form.get("locationLink") ?? "").trim();

    if (!customerName) next.customerName = "اسم العميل مطلوب.";
    if (!customerPhone) next.customerPhone = "هاتف العميل مطلوب.";
    else if (!/^[\d+\s()-]{5,}$/.test(customerPhone)) {
      next.customerPhone = "صيغة رقم الهاتف غير صحيحة.";
    }
    if (!pickupAddress) next.pickupAddress = "عنوان الاستلام مطلوب.";
    if (!dropoffAddress) next.dropoffAddress = "عنوان التسليم مطلوب.";
    if (!area) next.area = "المنطقة مطلوبة.";
    if (!Number.isFinite(amount) || amount <= 0) next.amount = "سعر الطلب يجب أن يكون أكبر من صفر.";
    if (cashCollection !== undefined && (!Number.isFinite(cashCollection) || cashCollection < 0)) {
      next.cashCollection = "تكلفة التوصيل يجب أن تكون رقمًا موجبًا أو صفر.";
    }
    if (includeMapPin && !dropoffCoords) {
      next.dropoffCoords = "فعّلت خيار الخريطة — اضغط على الخريطة لتحديد موقع التسليم.";
    }
    if (locationLink) {
      try {
        const u = new URL(locationLink);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          next.locationLink = "الرابط يجب أن يبدأ بـ http أو https.";
        }
      } catch {
        next.locationLink = "صيغة الرابط غير صحيحة — الصق الرابط كاملاً.";
      }
    }
    return next;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const sid = lockedStoreId ?? undefined;
    const baseNotes = String(form.get("notes") ?? "").trim();
    const locationLink = String(form.get("locationLink") ?? "").trim();
    const linkNote = locationLink ? `[رابط موقع] ${locationLink}` : "";
    const noMapNote =
      !includeMapPin || !dropoffCoords
        ? "[بدون إحداثيات خريطة — يؤكد الكابتن موقع التسليم من التطبيق عند الحاجة]"
        : "";
    const notesJoined = [baseNotes, linkNote, noMapNote].filter(Boolean).join("\n");

    create.mutate(
      {
        ...(sid ? { storeId: sid } : {}),
        customerName: String(form.get("customerName") ?? "").trim(),
        customerPhone: String(form.get("customerPhone") ?? "").trim(),
        pickupAddress: String(form.get("pickupAddress") ?? "").trim(),
        dropoffAddress: String(form.get("dropoffAddress") ?? "").trim(),
        area: String(form.get("area") ?? "").trim(),
        amount: Number(form.get("amount") ?? 0),
        cashCollection: form.get("cashCollection") ? Number(form.get("cashCollection")) : undefined,
        ...(includeMapPin && dropoffCoords
          ? { dropoffLatitude: dropoffCoords.lat, dropoffLongitude: dropoffCoords.lng }
          : {}),
        notes: notesJoined || undefined,
        distributionMode: "AUTO",
      },
      {
        onSuccess: () => void navigate("/orders"),
      },
    );
  }

  return (
    <form
      className="grid gap-6 rounded-2xl border border-card-border bg-card p-6 shadow-sm"
      onSubmit={onSubmit}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="customerName">اسم العميل</Label>
          <Input id="customerName" name="customerName" required maxLength={200} className={errorClass("customerName")} />
          {errors.customerName ? <p className="text-xs text-red-600">{errors.customerName}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="customerPhone">هاتف العميل</Label>
          <Input
            id="customerPhone"
            name="customerPhone"
            required
            dir="ltr"
            className={`text-left ${errorClass("customerPhone")}`}
          />
          {errors.customerPhone ? <p className="text-xs text-red-600">{errors.customerPhone}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pickupAddress">عنوان الاستلام</Label>
          <Input
            id="pickupAddress"
            name="pickupAddress"
            required
            maxLength={500}
            className={errorClass("pickupAddress")}
          />
          {errors.pickupAddress ? <p className="text-xs text-red-600">{errors.pickupAddress}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="dropoffAddress">عنوان التسليم</Label>
          <Input
            id="dropoffAddress"
            name="dropoffAddress"
            required
            maxLength={500}
            className={errorClass("dropoffAddress")}
          />
          {errors.dropoffAddress ? <p className="text-xs text-red-600">{errors.dropoffAddress}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="locationLink">لصق رابط الموقع (اختياري)</Label>
          <Input
            id="locationLink"
            name="locationLink"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://maps.app.goo.gl/..."
            maxLength={2000}
            dir="ltr"
            className={`text-left ${errorClass("locationLink")}`}
          />
          {errors.locationLink ? <p className="text-xs text-red-600">{errors.locationLink}</p> : null}
          <p className="text-xs text-muted">
            الصق رابط المشاركة من خرائط جوجل أو أي رابط https يوضح موقع التسليم؛ يُحفظ مع الملاحظات للكابتن.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="area">المنطقة</Label>
          <Input id="area" name="area" required maxLength={200} className={errorClass("area")} />
          {errors.area ? <p className="text-xs text-red-600">{errors.area}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amount">سعر الطلب</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            className={errorClass("amount")}
          />
          {errors.amount ? <p className="text-xs text-red-600">{errors.amount}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cashCollection">تكلفة التوصيل (اختياري)</Label>
          <Input
            id="cashCollection"
            name="cashCollection"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={errorClass("cashCollection")}
          />
          {errors.cashCollection ? <p className="text-xs text-red-600">{errors.cashCollection}</p> : null}
        </div>

        <div className="grid gap-3 sm:col-span-2">
          {!includeMapPin ? (
            <div
              className="rounded-xl border border-dashed border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100"
              role="status"
            >
              <p className="font-medium">لم يُحدَّد موقع على الخريطة</p>
              <p className="mt-1 text-xs opacity-90">
                يمكن للكابتن تأكيد أو ضبط موقع التسليم من تطبيق الكابتن عند استلام الطلب. لتثبيت موقع الآن، فعّل الخيار
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
                عند التفعيل، اضغط على الخريطة لتثبيت نقطة التسليم وإرسال الإحداثيات مع الطلب.
              </span>
            </span>
          </label>

          {includeMapPin ? (
            <div className="grid gap-2">
              <Label className="text-muted-foreground">خريطة تثبيت موقع التسليم</Label>
              <div
                ref={mapHostRef}
                className={`h-72 w-full overflow-hidden rounded-xl border ${errors.dropoffCoords ? "border-red-500" : "border-card-border"}`}
              />
              <p className="text-xs text-muted">اضغط على الخريطة لتثبيت موقع التسليم (دقة 6 منازل عشرية).</p>
              {errors.dropoffCoords ? <p className="text-xs text-red-600">{errors.dropoffCoords}</p> : null}
              {dropoffCoords ? (
                <div dir="ltr" className="text-xs font-mono text-muted">
                  lat: {dropoffCoords.lat}, lng: {dropoffCoords.lng}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="notes">ملاحظات</Label>
          <Textarea id="notes" name="notes" maxLength={2000} rows={3} />
        </div>
      </div>

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
  );
}
