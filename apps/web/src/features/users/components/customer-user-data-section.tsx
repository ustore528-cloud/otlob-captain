import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { clampLatLng, clampLatLngPair, ISRAEL_LEAFLET_MAX_BOUNDS, ISRAEL_MAP_DEFAULT_CENTER, ISRAEL_MAP_DEFAULT_ZOOM } from "@/lib/israel-map-bounds";
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

function dash(s: string | number | null | undefined, empty: string) {
  if (s == null || s === "") return empty;
  return String(s);
}

export function CustomerUserDataSection({ user: u, canEdit }: Props) {
  const { t } = useTranslation();
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

    const seed = dropoffCoords;
    if (seed) {
      const s = clampLatLngPair([seed.lat, seed.lng]);
      map.setView(s, 15);
      markerRef.current = L.circleMarker(s, {
        radius: 8,
        color: "#2563eb",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      }).addTo(map);
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read latest dropoffCoords only when map opens
  }, [editing, includeMapPin]);

  const errorClass = (name: string) => (errors[name] ? "border-red-500 focus-visible:ring-red-300" : "");

  function validate(form: FormData) {
    const next: Record<string, string> = {};
    const locationLink = String(form.get("locationLink") ?? "").trim();
    if (locationLink) {
      try {
        const url = new URL(locationLink);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          next.locationLink = t("users.customerProfile.errors.linkScheme");
        }
      } catch {
        next.locationLink = t("users.customerProfile.errors.linkInvalid");
      }
    }
    const amountRaw = String(form.get("amount") ?? "").trim();
    const deliveryRaw = String(form.get("delivery") ?? "").trim();
    if (amountRaw && (!Number.isFinite(Number(amountRaw)) || Number(amountRaw) < 0)) {
      next.amount = t("users.customerProfile.errors.amount");
    }
    if (deliveryRaw && (!Number.isFinite(Number(deliveryRaw)) || Number(deliveryRaw) < 0)) {
      next.delivery = t("users.customerProfile.errors.delivery");
    }
    if (includeMapPin && !dropoffCoords) {
      next.dropoffCoords = t("users.customerProfile.errors.mapRequired");
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

  const emptyDisplay = t("common.none");

  return (
    <div className="mt-3 border-t border-card-border pt-3">
      <p className="mb-2 text-xs font-medium text-muted">{t("users.customerProfile.sectionTitle")}</p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">{t("users.customerProfile.sectionBody")}</p>

      {!editing ? (
        <div className="grid gap-2 text-sm">
          <Row label={t("users.customerProfile.rows.pickup")} value={dash(u.customerPickupAddress, emptyDisplay)} />
          <Row label={t("users.customerProfile.rows.dropoff")} value={dash(u.customerDropoffAddress, emptyDisplay)} />
          <Row label={t("users.customerProfile.rows.link")} value={dash(u.customerLocationLink, emptyDisplay)} mono />
          <Row label={t("users.customerProfile.rows.area")} value={dash(u.customerArea, emptyDisplay)} />
          <Row label={t("users.customerProfile.rows.amount")} value={dash(u.customerPreferredAmount, emptyDisplay)} />
          <Row label={t("users.customerProfile.rows.delivery")} value={dash(u.customerPreferredDelivery, emptyDisplay)} />
          {u.customerDropoffLat != null && u.customerDropoffLng != null ? (
            <div dir="ltr" className="text-xs font-mono text-muted">
              {t("users.customerProfile.coordsSaved", { lat: u.customerDropoffLat, lng: u.customerDropoffLng })}
            </div>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">{t("users.customerProfile.coordsNone")}</p>
          )}
          {canEdit ? (
            <Button type="button" size="sm" variant="secondary" className="mt-1 w-full sm:w-auto" onClick={() => setEditing(true)}>
              {t("users.customerProfile.edit")}
            </Button>
          ) : null}
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`pickup-${u.id}`}>{t("users.customerProfile.pickupLabel")}</Label>
              <Input
                id={`pickup-${u.id}`}
                name="pickupAddress"
                maxLength={500}
                defaultValue={u.customerPickupAddress ?? ""}
                className={errorClass("pickupAddress")}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`dropoff-${u.id}`}>{t("users.customerProfile.dropoffLabel")}</Label>
              <Input
                id={`dropoff-${u.id}`}
                name="dropoffAddress"
                maxLength={500}
                defaultValue={u.customerDropoffAddress ?? ""}
                className={errorClass("dropoffAddress")}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`link-${u.id}`}>{t("users.customerProfile.linkLabel")}</Label>
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
              <p className="text-xs text-muted">{t("users.customerProfile.linkHelp")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`area-${u.id}`}>{t("users.customerProfile.areaLabel")}</Label>
              <Input id={`area-${u.id}`} name="area" maxLength={200} defaultValue={u.customerArea ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`amount-${u.id}`}>{t("users.customerProfile.amountLabel")}</Label>
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
              <Label htmlFor={`delivery-${u.id}`}>{t("users.customerProfile.deliveryLabel")}</Label>
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
                  <p className="font-medium">{t("users.customerProfile.mapNoneTitle")}</p>
                  <p className="mt-1 text-xs opacity-90">{t("users.customerProfile.mapNoneBody")}</p>
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
                  <span className="font-medium">{t("users.customerProfile.mapToggleTitle")}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t("users.customerProfile.mapToggleBody")}</span>
                </span>
              </label>

              {includeMapPin ? (
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">{t("users.customerProfile.mapLabel")}</Label>
                  <div
                    ref={mapHostRef}
                    className={`h-56 w-full overflow-hidden rounded-xl border ${errors.dropoffCoords ? "border-red-500" : "border-card-border"}`}
                  />
                  <p className="text-xs text-muted">{t("users.customerProfile.mapHint")}</p>
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
              {t("users.customerProfile.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? t("common.saving") : t("users.customerProfile.save")}
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
