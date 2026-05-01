import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, AlertCircle, CheckCircle2, Smartphone } from "lucide-react";
import { apiFetch, paths, ApiError } from "@/lib/api/http";
import { shouldRegisterCustomerPushServiceWorker } from "@/lib/customer-push-sw-environment";
import { toast } from "@/lib/toast";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** iPhone/iPod Touch, iPad Safari UA, or iPadOS 13+ (often reports Macintosh + multi-touch). */
function detectIosOrIpados(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = typeof navigator.userAgent === "string" ? navigator.userAgent : "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  const platform = typeof navigator.platform === "string" ? navigator.platform : "";
  return platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function detectStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    if (globalThis.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  } catch {
    /* ignore */
  }
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/** Opt-in UX only — permission is requested inside `subscribe()`, never on mount. */
type OptInPhase =
  | "default"
  | "unsupported"
  | "iosPwaBlocked"
  | "deployUnsupported"
  | "denied"
  | "failed"
  | "subscribed";

export function CustomerOrderBrowserNotifications(props: {
  trackingToken: string | null;
  rtl: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [attemptFailed, setAttemptFailed] = useState(false);
  /** Shown after an explicit denial from the prompt (we do not toast for denial). */
  const [explicitlyDenied, setExplicitlyDenied] = useState(false);

  const localeUi = useMemo(() => {
    const raw = i18n.resolvedLanguage ?? i18n.language;
    const lng = typeof raw === "string" ? raw.split("-")[0]?.toLowerCase() : "en";
    return lng === "ar" || lng === "he" ? lng : "en";
  }, [i18n.language, i18n.resolvedLanguage]);

  const isIosDevice = typeof window !== "undefined" && detectIosOrIpados();
  const isStandaloneApp = typeof window !== "undefined" && detectStandaloneDisplayMode();

  const apisPresent =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const iosNeedsHomeScreenInstall = isIosDevice && !isStandaloneApp;

  const apisMissing = Boolean(props.trackingToken && typeof window !== "undefined" && !apisPresent);

  const iosPwaBlocked = Boolean(
    props.trackingToken && typeof window !== "undefined" && apisPresent && iosNeedsHomeScreenInstall,
  );

  const deployUnsupported = Boolean(props.trackingToken && !shouldRegisterCustomerPushServiceWorker());

  const permissionDenied =
    typeof globalThis.Notification !== "undefined" && Notification.permission === "denied";
  const permissionGranted =
    typeof globalThis.Notification !== "undefined" && Notification.permission === "granted";

  const phase: OptInPhase = useMemo(() => {
    if (!props.trackingToken) return "default";
    if (apisMissing) return "unsupported";
    if (deployUnsupported) return "deployUnsupported";
    if (iosPwaBlocked) return "iosPwaBlocked";
    if (explicitlyDenied || permissionDenied) return "denied";
    if (subscribed) return "subscribed";
    if (attemptFailed) return "failed";
    return "default";
  }, [
    apisMissing,
    attemptFailed,
    deployUnsupported,
    explicitlyDenied,
    iosPwaBlocked,
    permissionDenied,
    props.trackingToken,
    subscribed,
  ]);

  const resolveVapidPublicKey = useCallback(async (): Promise<string> => {
    const fromEnv =
      typeof import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY === "string"
        ? import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY.trim()
        : "";
    if (fromEnv) return fromEnv;
    const { publicKey } = await apiFetch<{ publicKey: string }>(paths.public.webPushPublicKey, { method: "GET" });
    return typeof publicKey === "string" ? publicKey.trim() : "";
  }, []);

  const subscribe = async () => {
    const tok = props.trackingToken;
    if (!tok || typeof globalThis.Notification === "undefined") {
      return;
    }
    if (!shouldRegisterCustomerPushServiceWorker()) {
      return;
    }
    setBusy(true);
    setAttemptFailed(false);
    setExplicitlyDenied(false);
    try {
      const perm = await globalThis.Notification.requestPermission();
      if (perm !== "granted") {
        setExplicitlyDenied(true);
        setBusy(false);
        return;
      }

      let reg =
        typeof navigator.serviceWorker.getRegistration === "function"
          ? await navigator.serviceWorker.getRegistration("/")
          : null;
      if (!reg || !reg.active) {
        if (!navigator.serviceWorker?.register) {
          setAttemptFailed(true);
          setBusy(false);
          return;
        }
        reg = await navigator.serviceWorker.register("/customer-order-sw.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;

      const publicKey = await resolveVapidPublicKey();
      if (!publicKey) {
        throw new Error("WEB_PUSH_NO_PUBLIC_KEY");
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const j = sub.toJSON();
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
        throw new Error("BAD_SUBSCRIPTION");
      }

      const ua =
        typeof navigator.userAgent === "string" && navigator.userAgent.trim() !== ""
          ? navigator.userAgent.trim()
          : undefined;
      const platform =
        typeof navigator.platform === "string" && navigator.platform.trim() !== ""
          ? navigator.platform.trim()
          : undefined;

      await apiFetch(paths.public.ordersPushSubscription(tok), {
        method: "POST",
        body: JSON.stringify({
          locale: localeUi,
          userAgent: ua,
          platform,
          subscription: {
            endpoint: j.endpoint,
            keys: {
              p256dh: j.keys.p256dh,
              auth: j.keys.auth,
            },
          },
        }),
      });

      setSubscribed(true);
      setAttemptFailed(false);
      toast.success(t("customerNotifications.enabledSuccess"), {
        description: t("customerNotifications.enabledSuccessDetail"),
      });
    } catch (e: unknown) {
      setAttemptFailed(true);
      setSubscribed(false);
      if (e instanceof ApiError && e.code === "WEB_PUSH_UNAVAILABLE") {
        toast.error(t("public.orderExperience.offlinePushUnavailableHint"));
      } else {
        toast.error(t("public.orderExperience.offlinePushFailedToast"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!props.trackingToken) {
    return null;
  }

  const pad = props.rtl ? "ps-1" : "pe-1";

  const iphoneSteps = [
    t("customerNotifications.iosStepShare"),
    t("customerNotifications.iosStepAddHome"),
    t("customerNotifications.iosStepOpenIcon"),
    t("customerNotifications.iosStepEnable"),
  ];

  return (
    <div className={`mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm ${pad}`} dir={props.rtl ? "rtl" : "ltr"}>
      {phase === "unsupported" ? (
        <div className="flex gap-2.5 text-start">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <p className="text-[13px] leading-relaxed text-slate-700">{t("public.orderExperience.orderNotificationsOptIn_unsupported")}</p>
        </div>
      ) : null}

      {phase === "deployUnsupported" ? (
        <div className="flex gap-2.5 text-start">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <p className="text-[13px] leading-relaxed text-slate-600">{t("public.orderExperience.offlinePushProdOnlyHint")}</p>
        </div>
      ) : null}

      {phase === "iosPwaBlocked" ? (
        <div className="flex gap-3 text-start">
          <Smartphone className="mt-0.5 size-[18px] shrink-0 text-[color:var(--brand-primary-dark)]" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{t("customerNotifications.iosTitle")}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                {t("customerNotifications.iosBody")}
              </p>
            </div>
            <ol className="list-decimal space-y-1.5 ps-5 text-[12px] leading-relaxed text-slate-700">
              {iphoneSteps.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <p className="text-[11px] leading-relaxed text-slate-500">{t("public.orderExperience.orderNotificationsOptIn_iphoneDisclaimer")}</p>
          </div>
        </div>
      ) : null}

      {phase === "denied" ? (
        <div className="flex gap-2.5 text-start">
          <Bell className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <p className="text-[13px] leading-relaxed text-slate-700">{t("customerNotifications.permissionDenied")}</p>
        </div>
      ) : null}

      {phase === "failed" ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2.5 text-start">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
            <p className="text-[13px] leading-relaxed text-slate-700">{t("customerNotifications.setupFailed")}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void subscribe()}
            className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {busy ? t("customerNotifications.enableBusy") : t("customerNotifications.retryButton")}
          </button>
        </div>
      ) : null}

      {phase === "subscribed" ? (
        <div className="flex gap-2.5 text-start">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t("customerNotifications.enabledSuccess")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
              {t("customerNotifications.enabledSuccessDetail")}
            </p>
          </div>
        </div>
      ) : null}

      {phase === "default" ? (
        <div className="flex gap-3 text-start">
          <BellRing className="mt-0.5 size-[18px] shrink-0 text-[color:var(--brand-primary-dark)]" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-bold text-slate-900">{t("customerNotifications.enableTitle")}</p>
            <p className="text-[12px] leading-relaxed text-slate-600">{t("customerNotifications.enableBody")}</p>
            {permissionGranted ? (
              <p className="text-[11px] leading-relaxed text-emerald-800/95">{t("customerNotifications.grantReady")}</p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void subscribe()}
              className="mt-1 inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-[color:var(--brand-primary-dark)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? t("customerNotifications.enableBusy") : t("customerNotifications.enableButton")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
