import type { OrderStatus, ActiveMapCaptain } from "@/types/api";
import { assignmentOfferSecondsLeft, captainMapVisual, isCaptainLocationStale } from "@/features/distribution/captain-map-visual";
import { isRtlLang } from "@/i18n/i18n";
import i18n from "@/i18n/i18n";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";

export type QuickAlertPreset = "review_order" | "contact_customer" | "speed_delivery" | "contact_dispatch";

/**
 * API notification copy sent to the captain app.
 * Intentionally kept stable (Arabic) — UI labels are translated separately.
 */
export const QUICK_ALERT_PRESET_API_COPY: Record<QuickAlertPreset, { title: string; message: string }> = {
  review_order: {
    title: "تنبيه من التوزيع: مراجعة الطلب",
    message: "يُرجى مراجعة الطلب المسند والتأكد من التفاصيل.",
  },
  contact_customer: {
    title: "تنبيه من التوزيع: التواصل مع العميل",
    message: "يُرجى التواصل مع العميل بخصوص الطلب الحالي.",
  },
  speed_delivery: {
    title: "تنبيه من التوزيع: تسريع التوصيل",
    message: "يُرجى تسريع إتمام التوصيل عند الإمكان.",
  },
  contact_dispatch: {
    title: "تنبيه من التوزيع: التواصل مع غرفة التحكم",
    message: "يُرجى التواصل مع غرفة التحكم عند الحاجة.",
  },
};

/** @deprecated Use `QUICK_ALERT_PRESET_API_COPY` (kept for backwards compatibility). */
export const QUICK_ALERT_PRESET_COPY = QUICK_ALERT_PRESET_API_COPY;

export const DISPATCH_QUICK_ALERT_TYPE = "DISPATCH_QUICK_ALERT";

const VEHICLE_TYPE_TO_KEY: Record<string, "BICYCLE" | "MOTORCYCLE" | "CAR" | "CARGO"> = {
  "بسكليت": "BICYCLE",
  "دراجه ناريه": "MOTORCYCLE",
  "سيارة": "CAR",
  "شحن نقل": "CARGO",
};

function formatRecordedAt(iso: string): string {
  try {
    // Keep Western digits (0–9) regardless of UI language.
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short", hour12: false });
  } catch {
    return iso;
  }
}

function vehicleTypeUi(vehicleType: string): string {
  const mapped = VEHICLE_TYPE_TO_KEY[vehicleType];
  if (mapped) return String(i18n.t(`distribution.vehicle.${mapped}`));
  return vehicleType;
}

function orderStatusUi(status: string | null | undefined): string {
  if (!status) return "—";
  const key = `orderStatus.${status}`;
  return i18n.exists(key) ? String(i18n.t(key)) : status;
}

export type CaptainPopupHandlers = {
  sendQuickAlertPreset: (c: ActiveMapCaptain, preset: QuickAlertPreset) => Promise<void>;
};

/**
 * Captain card embedded in Leaflet (DOM only).
 */
export function buildCaptainPopupElement(c: ActiveMapCaptain, handlers: CaptainPopupHandlers): HTMLElement {
  const vis = captainMapVisual(c);
  const visLabel = String(i18n.t(`distribution.mapVisual.${vis.labelKey}`));
  const loc = c.lastLocation!;
  const stale = isCaptainLocationStale(c);
  const secLeft =
    c.waitingOffers > 0 && c.assignmentOfferExpiresAt
      ? assignmentOfferSecondsLeft(c.assignmentOfferExpiresAt)
      : null;

  const root = document.createElement("div");
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);
  root.dir = rtl ? "rtl" : "ltr";
  root.className = "distribution-captain-popup-root";
  root.style.cssText = `min-width:168px;max-width:232px;font-size:11px;line-height:1.35;text-align:${
    rtl ? "right" : "left"
  };font-family:inherit;color:var(--foreground, #0f172a);`;

  const lang = i18n.resolvedLanguage ?? i18n.language;
  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;font-size:12px;margin-bottom:3px;line-height:1.25;word-break:break-word;";
  title.textContent = getLocalizedText(c.user.fullName, {
    lang,
    valueTranslations: c.user.displayI18n?.fullName,
    mode: "generic",
  });
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.style.cssText = "font-size:10px;color:var(--muted-foreground,#64748b);margin-bottom:4px;";
  meta.textContent = `${visLabel} · ${vehicleTypeUi(c.vehicleType)}`;
  root.appendChild(meta);

  if (c.area?.trim()) {
    const areaEl = document.createElement("div");
    areaEl.style.cssText = "font-size:10px;color:var(--muted-foreground,#64748b);margin-bottom:4px;word-break:break-word;";
    areaEl.textContent = getLocalizedText(c.area, { lang, valueTranslations: c.displayI18n?.area, mode: "place" });
    root.appendChild(areaEl);
  }

  const orders = document.createElement("div");
  orders.style.cssText = "font-size:10px;margin-bottom:3px;";
  orders.innerHTML = String(
    i18n.t("distribution.popup.ordersLine", { active: c.activeOrders, waiting: c.waitingOffers }),
  );
  root.appendChild(orders);

  if (c.latestOrderNumber) {
    const lo = document.createElement("div");
    lo.style.cssText = "margin-bottom:3px;font-size:10px;color:var(--muted-foreground,#64748b);";
    lo.innerHTML = `<span dir="ltr" style="display:inline-block">${c.latestOrderNumber}</span> (${orderStatusUi(
      c.latestOrderStatus as OrderStatus,
    )})`;
    root.appendChild(lo);
  }

  const time = document.createElement("div");
  time.style.cssText = "margin-bottom:4px;font-size:9px;color:var(--muted-foreground,#94a3b8);";
  time.textContent = stale
    ? `موقع قديم · ${String(i18n.t("distribution.popup.location", { at: formatRecordedAt(loc.recordedAt) }))}`
    : String(i18n.t("distribution.popup.location", { at: formatRecordedAt(loc.recordedAt) }));
  root.appendChild(time);

  if (secLeft !== null) {
    const offer = document.createElement("div");
    offer.style.cssText =
      "margin-bottom:6px;padding:3px 6px;border-radius:5px;background:rgba(245,158,11,.12);font-size:10px;font-weight:700;color:#92400e;text-align:center;";
    offer.textContent = String(i18n.t("distribution.popup.acceptDeadline", { sec: secLeft }));
    root.appendChild(offer);
  }

  const commWrap = document.createElement("div");
  commWrap.style.cssText = "position:relative;margin-top:2px;border-top:1px solid var(--border,#e2e8f0);padding-top:6px;";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;";

  const rowLabel = document.createElement("span");
  rowLabel.style.cssText = "font-size:10px;font-weight:800;color:var(--foreground,#0f172a);";
  rowLabel.textContent = String(i18n.t("distribution.popup.contact"));

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-haspopup", "true");
  toggle.title = String(i18n.t("distribution.popup.openContactMenu"));
  toggle.style.cssText =
    "flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:var(--background,#fff);cursor:pointer;font-size:12px;line-height:1;color:var(--foreground,#0f172a);";
  toggle.innerHTML = "&#9662;";

  const menu = document.createElement("div");
  menu.style.cssText =
    "display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:10000;padding:4px;border-radius:8px;border:1px solid var(--border,#e2e8f0);background:var(--background,#fff);box-shadow:0 8px 20px rgba(15,23,42,.12);";

  let docClose: ((ev: MouseEvent) => void) | null = null;

  const closeMenu = () => {
    menu.style.display = "none";
    toggle.setAttribute("aria-expanded", "false");
    if (docClose) {
      document.removeEventListener("click", docClose, true);
      docClose = null;
    }
  };

  const openMenu = () => {
    menu.style.display = "block";
    toggle.setAttribute("aria-expanded", "true");
    window.setTimeout(() => {
      docClose = (ev: MouseEvent) => {
        if (!commWrap.contains(ev.target as Node)) closeMenu();
      };
      document.addEventListener("click", docClose, true);
    }, 0);
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (menu.style.display === "none" || menu.style.display === "") openMenu();
    else closeMenu();
  });

  const mkBtn = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = `display:block;width:100%;text-align:${
      rtl ? "right" : "left"
    };padding:6px 8px;border:none;border-radius:6px;background:transparent;cursor:pointer;font-size:11px;font-weight:600;color:var(--foreground,#0f172a);`;
    b.addEventListener("mouseenter", () => {
      b.style.background = "var(--muted,#f1f5f9)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "transparent";
    });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
      closeMenu();
    });
    return b;
  };

  const tel = c.user.phone.replace(/[^\d+]/g, "");
  const callBtn = mkBtn(String(i18n.t("distribution.popup.callCaptain")), () => {
    if (tel) window.location.href = `tel:${tel}`;
  });
  menu.appendChild(callBtn);

  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;margin:4px 0;background:var(--border,#e2e8f0);";
  menu.appendChild(sep);

  const alertLabel = document.createElement("div");
  alertLabel.style.cssText = "padding:2px 8px 4px;font-size:9px;font-weight:700;color:var(--muted-foreground,#64748b);";
  alertLabel.textContent = String(i18n.t("distribution.popup.quickAlertMenuTitle"));
  menu.appendChild(alertLabel);

  const presets: { preset: QuickAlertPreset; label: string }[] = [
    { preset: "review_order", label: String(i18n.t("distribution.popup.presets.review_order")) },
    { preset: "contact_customer", label: String(i18n.t("distribution.popup.presets.contact_customer")) },
    { preset: "speed_delivery", label: String(i18n.t("distribution.popup.presets.speed_delivery")) },
    { preset: "contact_dispatch", label: String(i18n.t("distribution.popup.presets.contact_dispatch")) },
  ];

  for (const { preset, label } of presets) {
    const b = mkBtn(label, () => {
      void (async () => {
        b.disabled = true;
        try {
          await handlers.sendQuickAlertPreset(c, preset);
        } finally {
          b.disabled = false;
        }
      })();
    });
    menu.appendChild(b);
  }

  row.appendChild(rowLabel);
  row.appendChild(toggle);
  commWrap.appendChild(row);
  commWrap.appendChild(menu);
  root.appendChild(commWrap);

  return root;
}
