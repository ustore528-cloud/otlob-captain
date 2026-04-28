import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCreateOrder } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isCompanyAdminRole, isStoreAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { clampLatLng, clampLatLngPair, ISRAEL_LEAFLET_MAX_BOUNDS, ISRAEL_MAP_DEFAULT_CENTER, ISRAEL_MAP_DEFAULT_ZOOM } from "@/lib/israel-map-bounds";

export function NewOrderForm() {
  const { t } = useTranslation();
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
  const isCompanyAdmin = isCompanyAdminRole(user?.role);

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

    const maxBounds = L.latLngBounds(ISRAEL_LEAFLET_MAX_BOUNDS);
    const map = L.map(host, {
      zoomControl: true,
      maxBounds,
      maxBoundsViscosity: 1,
    }).setView(ISRAEL_MAP_DEFAULT_CENTER, ISRAEL_MAP_DEFAULT_ZOOM);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    requestAnimationFrame(() => map.invalidateSize());
    map.on("click", (ev) => {
      const cl = clampLatLng(ev.latlng.lat, ev.latlng.lng);
      const lat = Number(cl.lat.toFixed(6));
      const lng = Number(cl.lng.toFixed(6));
      setDropoffCoords({ lat, lng });
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(clampLatLngPair([ev.latlng.lat, ev.latlng.lng]), {
          radius: 8,
          color: "#2563eb",
          weight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.9,
        }).addTo(map);
      } else markerRef.current.setLatLng(clampLatLngPair([ev.latlng.lat, ev.latlng.lng]));
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
    const deliveryFeeRaw = String(form.get("deliveryFee") ?? "").trim();
    const deliveryFee = deliveryFeeRaw ? Number(deliveryFeeRaw) : 0;
    const locationLink = String(form.get("locationLink") ?? "").trim();

    if (!customerName) next.customerName = t("newOrder.form.errors.customerName");
    if (!customerPhone) next.customerPhone = t("newOrder.form.errors.customerPhone");
    else if (!/^[\d+\s()-]{5,}$/.test(customerPhone)) {
      next.customerPhone = t("newOrder.form.errors.phoneFormat");
    }
    if (!pickupAddress) {
      next.pickupAddress = isCompanyAdmin
        ? t("newOrder.form.errors.pickupCompany")
        : t("newOrder.form.errors.pickup");
    }
    if (!dropoffAddress) {
      next.dropoffAddress = isCompanyAdmin
        ? t("newOrder.form.errors.dropoffCompany")
        : t("newOrder.form.errors.dropoff");
    }
    if (!area) next.area = t("newOrder.form.errors.area");
    if (!Number.isFinite(amount) || amount <= 0) {
      next.amount = isCompanyAdmin ? t("newOrder.form.errors.amountCompany") : t("newOrder.form.errors.amount");
    }
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      next.deliveryFee = t("newOrder.form.errors.deliveryFee");
    }
    if (includeMapPin && !dropoffCoords) {
      next.dropoffCoords = t("newOrder.form.errors.mapRequired");
    }
    if (locationLink) {
      try {
        const u = new URL(locationLink);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          next.locationLink = t("newOrder.form.errors.linkScheme");
        }
      } catch {
        next.locationLink = t("newOrder.form.errors.linkInvalid");
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
    const linkNote = locationLink ? t("newOrder.form.notesLine.locationLink", { link: locationLink }) : "";
    const noMapNote = !includeMapPin || !dropoffCoords ? t("newOrder.form.notesLine.noMap") : "";
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
        deliveryFee: String(form.get("deliveryFee") ?? "").trim()
          ? Number(form.get("deliveryFee"))
          : 0,
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
          <Label htmlFor="customerName">{t("newOrder.form.customerName")}</Label>
          <Input id="customerName" name="customerName" required maxLength={200} className={errorClass("customerName")} />
          {errors.customerName ? <p className="text-xs text-red-600">{errors.customerName}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="customerPhone">{t("newOrder.form.customerPhone")}</Label>
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
          <Label htmlFor="pickupAddress">
            {isCompanyAdmin ? t("newOrder.form.pickupAddressCompany") : t("newOrder.form.pickupAddress")}
          </Label>
          <Input
            id="pickupAddress"
            name="pickupAddress"
            required
            maxLength={500}
            className={errorClass("pickupAddress")}
            placeholder={isCompanyAdmin ? t("newOrder.form.pickupPlaceholderCompany") : undefined}
          />
          {errors.pickupAddress ? <p className="text-xs text-red-600">{errors.pickupAddress}</p> : null}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="dropoffAddress">
            {isCompanyAdmin ? t("newOrder.form.dropoffAddressCompany") : t("newOrder.form.dropoffAddress")}
          </Label>
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
          <Label htmlFor="locationLink">{t("newOrder.form.locationLink")}</Label>
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
          <p className="text-xs text-muted">{t("newOrder.form.locationLinkHelp")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="area">{t("newOrder.form.area")}</Label>
          <Input id="area" name="area" required maxLength={200} className={errorClass("area")} />
          {errors.area ? <p className="text-xs text-red-600">{errors.area}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amount">
            {isCompanyAdmin ? t("newOrder.form.amountCompany") : t("newOrder.form.amount")}
          </Label>
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
          <Label htmlFor="deliveryFee">{t("newOrder.form.deliveryFee")}</Label>
          <Input
            id="deliveryFee"
            name="deliveryFee"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className={errorClass("deliveryFee")}
          />
          {errors.deliveryFee ? <p className="text-xs text-red-600">{errors.deliveryFee}</p> : null}
          <p className="text-xs text-muted">
            {t("newOrder.form.deliveryFeeHelp", {
              amountLabel: isCompanyAdmin ? t("newOrder.form.amountCompany") : t("newOrder.form.amount"),
            })}
          </p>
        </div>

        <div className="grid gap-3 sm:col-span-2">
          {!includeMapPin ? (
            <div
              className="rounded-xl border border-dashed border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100"
              role="status"
            >
              <p className="font-medium">{t("newOrder.form.mapNoneTitle")}</p>
              <p className="mt-1 text-xs opacity-90">{t("newOrder.form.mapNoneBody")}</p>
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
              <span className="font-medium">{t("newOrder.form.mapToggleTitle")}</span>
              <span className="mt-0.5 block text-xs text-muted">{t("newOrder.form.mapToggleBody")}</span>
            </span>
          </label>

          {includeMapPin ? (
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("newOrder.form.mapLabel")}</Label>
              <div
                ref={mapHostRef}
                className={`h-72 w-full overflow-hidden rounded-xl border ${errors.dropoffCoords ? "border-red-500" : "border-card-border"}`}
              />
              <p className="text-xs text-muted">{t("newOrder.form.mapHint")}</p>
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
          <Label htmlFor="notes">{t("newOrder.form.notes")}</Label>
          <Textarea id="notes" name="notes" maxLength={2000} rows={3} />
        </div>
      </div>

      {create.isError ? <p className="text-sm text-red-600">{(create.error as Error).message}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => void navigate(-1)}>
          {t("newOrder.form.back")}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t("newOrder.form.creating") : t("newOrder.form.submit")}
        </Button>
      </div>
    </form>
  );
}
