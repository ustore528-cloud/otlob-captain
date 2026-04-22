import type { ActiveMapCaptain } from "@/types/api";
import { assignmentOfferSecondsLeft, captainMapVisual } from "@/features/distribution/captain-map-visual";

export type QuickAlertPreset = "review_order" | "contact_customer" | "speed_delivery" | "contact_dispatch";

/** نصوص موحّدة للواجهة ولـ API (إشعار يظهر في تطبيق الكابتن) */
export const QUICK_ALERT_PRESET_COPY: Record<QuickAlertPreset, { title: string; message: string }> = {
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

export const DISPATCH_QUICK_ALERT_TYPE = "DISPATCH_QUICK_ALERT";

function formatRecordedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export type CaptainPopupHandlers = {
  sendQuickAlertPreset: (c: ActiveMapCaptain, preset: QuickAlertPreset) => Promise<void>;
};

/**
 * بطاقة كابتن مدمجة لـ Leaflet — DOM فقط؛ محتوى ثابت عند `setContent`.
 */
export function buildCaptainPopupElement(c: ActiveMapCaptain, handlers: CaptainPopupHandlers): HTMLElement {
  const vis = captainMapVisual(c);
  const loc = c.lastLocation!;
  const secLeft =
    c.waitingOffers > 0 && c.assignmentOfferExpiresAt
      ? assignmentOfferSecondsLeft(c.assignmentOfferExpiresAt)
      : null;

  const root = document.createElement("div");
  root.dir = "rtl";
  root.className = "distribution-captain-popup-root";
  root.style.cssText =
    "min-width:168px;max-width:232px;font-size:11px;line-height:1.35;text-align:right;font-family:inherit;color:var(--foreground, #0f172a);";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;font-size:12px;margin-bottom:3px;line-height:1.25;word-break:break-word;";
  title.textContent = c.user.fullName;
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.style.cssText = "font-size:10px;color:var(--muted-foreground,#64748b);margin-bottom:4px;";
  meta.textContent = `${vis.label} · ${c.vehicleType}`;
  root.appendChild(meta);

  const orders = document.createElement("div");
  orders.style.cssText = "font-size:10px;margin-bottom:3px;";
  orders.innerHTML = `<span style="font-weight:700">نشطة:</span> ${c.activeOrders} · <span style="font-weight:700">بانتظار رد:</span> ${c.waitingOffers}`;
  root.appendChild(orders);

  if (c.latestOrderNumber) {
    const lo = document.createElement("div");
    lo.style.cssText = "margin-bottom:3px;font-size:10px;color:var(--muted-foreground,#64748b);";
    lo.innerHTML = `<span dir="ltr" style="display:inline-block">${c.latestOrderNumber}</span> (${c.latestOrderStatus ?? "—"})`;
    root.appendChild(lo);
  }

  const time = document.createElement("div");
  time.style.cssText = "margin-bottom:4px;font-size:9px;color:var(--muted-foreground,#94a3b8);";
  time.textContent = `الموقع: ${formatRecordedAt(loc.recordedAt)}`;
  root.appendChild(time);

  if (secLeft !== null) {
    const offer = document.createElement("div");
    offer.style.cssText =
      "margin-bottom:6px;padding:3px 6px;border-radius:5px;background:rgba(245,158,11,.12);font-size:10px;font-weight:700;color:#92400e;text-align:center;";
    offer.textContent = `مهلة القبول: ${secLeft} ث`;
    root.appendChild(offer);
  }

  const commWrap = document.createElement("div");
  commWrap.style.cssText = "position:relative;margin-top:2px;border-top:1px solid var(--border,#e2e8f0);padding-top:6px;";

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;";

  const rowLabel = document.createElement("span");
  rowLabel.style.cssText = "font-size:10px;font-weight:800;color:var(--foreground,#0f172a);";
  rowLabel.textContent = "تواصل";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-haspopup", "true");
  toggle.title = "فتح خيارات التواصل";
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
    b.style.cssText =
      "display:block;width:100%;text-align:right;padding:6px 8px;border:none;border-radius:6px;background:transparent;cursor:pointer;font-size:11px;font-weight:600;color:var(--foreground,#0f172a);";
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
  const callBtn = mkBtn("اتصال بالكابتن", () => {
    if (tel) window.location.href = `tel:${tel}`;
  });
  menu.appendChild(callBtn);

  const sep = document.createElement("div");
  sep.style.cssText = "height:1px;margin:4px 0;background:var(--border,#e2e8f0);";
  menu.appendChild(sep);

  const alertLabel = document.createElement("div");
  alertLabel.style.cssText = "padding:2px 8px 4px;font-size:9px;font-weight:700;color:var(--muted-foreground,#64748b);";
  alertLabel.textContent = "تنبيه سريع للكابتن";
  menu.appendChild(alertLabel);

  const presets: { preset: QuickAlertPreset; label: string }[] = [
    { preset: "review_order", label: "مراجعة الطلب المسند" },
    { preset: "contact_customer", label: "التواصل مع العميل" },
    { preset: "speed_delivery", label: "تسريع التوصيل" },
    { preset: "contact_dispatch", label: "التواصل مع غرفة التحكم" },
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
