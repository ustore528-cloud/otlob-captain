import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlignLeft,
  ArrowLeft,
  Bell,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Loader2,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  MessageCircle,
  LocateFixed,
  Send,
  ShieldCheck,
  Upload,
  UserRound,
  UtensilsCrossed,
  HelpCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { ApiError } from "@/lib/api/http";
import {
  createPublicOrder,
  fetchNearbyCaptains,
  fetchPublicOrderTracking,
  reverseGeocodePickup,
  submitPublicComplaint,
  type PublicCreateOrderResult,
  type PublicOrderTrackingResult,
  type PublicRequestContext,
} from "@/lib/api/services/public-request";
import { LanguageSwitcher } from "@/components/language-switcher";
import { isRtlLang } from "@/i18n/i18n";
import { isReasonableFlexiblePhone } from "@captain/shared";
import { isValidLatLng } from "@/lib/geo-validation";
import { useTranslation } from "react-i18next";
import { PublicTrackingLeaflet, type MapPoint } from "@/features/public-request/public-tracking-leaflet";
import {
  loadPublicRequestSenderProfile,
  removePublicRequestSenderProfile,
  savePublicRequestSenderProfile,
} from "@/features/public-request/public-sender-storage";

/** Preview map: fixed 5 km aerial / haversine radius for “nearby captains” markers. */
const CAPTAIN_MAP_PREVIEW_RADIUS_KM = 5;

/** Success-stage wait: after this, widen nearby preview to 7 km only if no riders were found within 5 km. */
const SUCCESS_WAIT_NEARBY_INITIAL_KM = 5;
const SUCCESS_WAIT_NEARBY_EXPANDED_KM = 7;
const SUCCESS_WAIT_EXPAND_MS = 3 * 60 * 1000;

/** Distinct hues for leaflet markers — brand palette (captain pins). */
const CAPT_NEARBY_COLORS = ["#c62828", "#d4af37", "#8e1b1b", "#a67c00"];

function digitsForWhatsApp(phone: string | null | undefined): string | null {
  const cleaned = String(phone ?? "").trim().replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  const noPlus = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const digits = noPlus.startsWith("00") ? noPlus.slice(2) : noPlus;
  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

/** Legacy export — الواجهة تبدأ بقيمة منتج فارغة حتى يدخل المرسل الرقم.y */
export const PRICING_DEMO_DEFAULTS = {
  productAmount: "",
};

/** يزيل رموز العملات والمسافات قبل التحويل إلى رقم */
function normalizeProductAmountText(raw: string): string {
  return String(raw ?? "")
    .replace(/,/g, "")
    .replace(/[₪$€£\s\u200f\u200e\u00A0]/g, "")
    .trim();
}

/** قيمة المنتجات: فارغ لا يعتبر خطأ قبل الإرسال؛ غير عددي يعيد null؛ ≥0 عددًا. */
export function parseProductsAmountInput(raw: string): number | null {
  const s = normalizeProductAmountText(raw);
  if (s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseMoneyInput(raw: string): number {
  const n = parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const PACKAGE_OPTIONS = [
  { id: "food" as const, Icon: UtensilsCrossed },
  { id: "documents" as const, Icon: FileText },
  { id: "small" as const, Icon: Package },
  { id: "other" as const, Icon: HelpCircle },
] as const;

type PackageTypeId = (typeof PACKAGE_OPTIONS)[number]["id"];

/** Saved after API success — used by success layout + optional map previews. */
export type ReceiptState = {
  orderNumber: string;
  status: string;
  store: string;
  fee: string;
  collect: string;
  pickupAddress: string;
  dropoffAddress: string;
  captainName: string | null;
  captainPhone: string | null;
  orderId: string;
  ownerCode: string;
  trackingToken: string | null;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
};

type Step = "form" | "tracking";

type PublicRequestOrderExperienceProps = {
  ownerCode: string;
  ctx: PublicRequestContext;
  /** Initial error from outer scope (submit / load) — cleared when user submits again */
  bannerError?: string | null;
  onBannerConsumed?: () => void;
  onSuccess: (receipt: ReceiptState) => void;
  /** Called after a failed submission */
  onSubmitError?: (msg: string) => void;
};

export function PublicRequestOrderExperience({
  ownerCode,
  ctx,
  bannerError,
  onBannerConsumed,
  onSuccess,
  onSubmitError,
}: PublicRequestOrderExperienceProps) {
  const { i18n, t } = useTranslation();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);
  const orderSectionRef = useRef<HTMLDivElement | null>(null);
  const senderPickupStepAnchorRef = useRef<HTMLDivElement | null>(null);
  const pickupAddressInputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [orderWizardStep, setOrderWizardStep] = useState<1 | 2>(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLatStr, setPickupLatStr] = useState("");
  const [pickupLngStr, setPickupLngStr] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [senderFullName, setSenderFullName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  /** Recipient / delivery contact (API `customerName` / `customerPhone`). */
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [senderPhoneError, setSenderPhoneError] = useState<string | null>(null);
  const [customerPhoneError, setCustomerPhoneError] = useState<string | null>(null);
  /** When true, stepping forward or succeeding an order persists sender + pickup locally. */
  const [saveSenderProfileChecked, setSaveSenderProfileChecked] = useState(false);
  const [packageTypeId, setPackageTypeId] = useState<PackageTypeId>(PACKAGE_OPTIONS[0].id);
  const [notesExtra, setNotesExtra] = useState("");
  const [storeAmountStr, setStoreAmountStr] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoHint, setGeoHint] = useState<"idle" | "loading" | "success">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [complaintName, setComplaintName] = useState("");
  const [complaintPhone, setComplaintPhone] = useState("");
  const [complaintType, setComplaintType] = useState("");
  const [complaintMessage, setComplaintMessage] = useState("");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [complaintAlert, setComplaintAlert] = useState<{ tone: "ok" | "err"; message: string } | null>(null);
  const [complaintsPageOpen, setComplaintsPageOpen] = useState(false);

  const [adIndex, setAdIndex] = useState(0);

  const deliveryFeePreview = useMemo(
    () => parseMoneyInput(ctx?.pricing.calculatedDeliveryFee ?? "0").toFixed(2),
    [ctx?.pricing.calculatedDeliveryFee],
  );

  const parsedProductsAmount = useMemo(() => parseProductsAmountInput(storeAmountStr), [storeAmountStr]);

  /** يُعرض الإجمالي التقديري فقط بعد إدخال قيمة منتج صالحة. */
  const estimatedTotal = useMemo(() => {
    if (parsedProductsAmount === null) return null;
    const fee = parseMoneyInput(deliveryFeePreview);
    return (parsedProductsAmount + fee).toFixed(2);
  }, [parsedProductsAmount, deliveryFeePreview]);

  const zoneEligibleCount = useMemo(() => {
    if (!selectedZoneId.trim()) return null;
    return ctx.captainAvailability.zoneEligibleCounts.find((z) => z.zoneId === selectedZoneId)?.count ?? null;
  }, [ctx.captainAvailability.zoneEligibleCounts, selectedZoneId]);

  const captainAvailabilityState = useMemo(() => {
    if (!ctx) return "NONE" as const;
    if (
      selectedZoneId &&
      zoneEligibleCount === 0 &&
      ctx.captainAvailability.totalAvailableBikeCaptains > 0
    )
      return "BLOCKED" as const;
    if (ctx.captainAvailability.totalAvailableBikeCaptains > 0) return "FOUND" as const;
    return "NONE" as const;
  }, [ctx, selectedZoneId, zoneEligibleCount]);

  const carouselSlides = useMemo(
    () => ctx.publicPage?.carouselSlides?.filter(Boolean) ?? [],
    [ctx.publicPage?.carouselSlides],
  );

  const showCarouselUi = ctx.publicPage?.showCarousel !== false;
  const showComplaintsUi = ctx.publicPage?.showComplaintsBox !== false;
  const showBenefitsUi = ctx.publicPage?.showBenefitsRow !== false;

  const [nearbyMapBundle, setNearbyMapBundle] = useState<{ caption: string; points: MapPoint[] } | null>(null);

  useEffect(() => {
    const code = ownerCode.trim();
    if (!code) return;
    const saved = loadPublicRequestSenderProfile(code);
    setSaveSenderProfileChecked(!!saved);
    if (saved) {
      setSenderFullName((prev) => (prev.trim() ? prev : saved.fullName));
      setSenderPhone((prev) => (prev.trim() ? prev : saved.phone));
      setPickupAddress((prev) => (prev.trim() ? prev : saved.pickupAddress ?? ""));
      if (saved.pickupLatitude?.trim() && saved.pickupLongitude?.trim()) {
        setPickupLatStr((prev) => (prev.trim() ? prev : saved.pickupLatitude!));
        setPickupLngStr((prev) => (prev.trim() ? prev : saved.pickupLongitude!));
      }
    }
  }, [ownerCode]);

  const persistSenderPickupProfileGate = useCallback(() => {
    const code = ownerCode.trim();
    if (!code) return;
    if (!saveSenderProfileChecked) {
      removePublicRequestSenderProfile(code);
      return;
    }
    savePublicRequestSenderProfile(code, {
      fullName: senderFullName.trim(),
      phone: senderPhone.trim(),
      pickupAddress: pickupAddress.trim() || undefined,
      ...(pickupLatStr.trim() && pickupLngStr.trim()
        ? { pickupLatitude: pickupLatStr.trim(), pickupLongitude: pickupLngStr.trim() }
        : {}),
    });
  }, [
    ownerCode,
    saveSenderProfileChecked,
    senderFullName,
    senderPhone,
    pickupAddress,
    pickupLatStr,
    pickupLngStr,
  ]);

  const editSavedSenderPickup = useCallback(() => {
    setOrderWizardStep(1);
    void window.requestAnimationFrame(() => {
      senderPickupStepAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      pickupAddressInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const clearSavedSenderPickup = useCallback(() => {
    removePublicRequestSenderProfile(ownerCode.trim());
    setSaveSenderProfileChecked(false);
    setSenderFullName("");
    setSenderPhone("");
    setCustomerFullName("");
    setCustomerPhone("");
    setSenderPhoneError(null);
    setCustomerPhoneError(null);
    setPickupAddress("");
    setPickupLatStr("");
    setPickupLngStr("");
    setLocating(false);
    setGeoHint("idle");
    setGeoError(null);
  }, [ownerCode]);

  useEffect(() => {
    let cancelled = false;
    const plat = pickupLatStr.trim() ? Number(pickupLatStr) : NaN;
    const plng = pickupLngStr.trim() ? Number(pickupLngStr) : NaN;
    if (!isValidLatLng(plat, plng)) {
      setNearbyMapBundle(null);
      return;
    }
    const caption = ctx.publicPage?.nearbyCaption?.trim()
      ? ctx.publicPage.nearbyCaption
      : t("public.orderExperience.nearbyDefaultCaption", { km: CAPTAIN_MAP_PREVIEW_RADIUS_KM });
    const tid = window.setTimeout(() => {
      void fetchNearbyCaptains(ownerCode, plat, plng, CAPTAIN_MAP_PREVIEW_RADIUS_KM)
        .then((data) => {
          if (cancelled) return;
          const pts: MapPoint[] = [
            {
              lat: plat,
              lng: plng,
              label: t("public.orderExperience.captainRefPickup"),
              color: "#10b981",
            },
            ...data.captains.map((c, i) => ({
              lat: c.latitude,
              lng: c.longitude,
              label: t("public.orderExperience.captainMarkerLine", {
                label: c.label,
                dist: c.distanceKm,
                vehicle: c.vehicleType,
              }),
              color: CAPT_NEARBY_COLORS[i % CAPT_NEARBY_COLORS.length] ?? "#c62828",
            })),
          ];
          setNearbyMapBundle({ caption, points: pts });
        })
        .catch(() => {
          if (cancelled) return;
          setNearbyMapBundle(null);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [ownerCode, pickupLatStr, pickupLngStr, ctx.publicPage?.nearbyCaption, t]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    setAdIndex((i) => {
      const n = carouselSlides.length;
      if (n <= 0) return 0;
      return i >= n ? 0 : i;
    });
  }, [carouselSlides]);

  useEffect(() => {
    if (step !== "form" || !showCarouselUi || carouselSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setAdIndex((i) => (i + 1) % carouselSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [step, showCarouselUi, carouselSlides]);

  const activeSlide = carouselSlides[adIndex];

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (complaintsPageOpen) {
          setComplaintsPageOpen(false);
          return;
        }
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [complaintsPageOpen]);

  const fillPickupFromCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError(t("public.orderExperience.geoUnsupported"));
      return;
    }
    setGeoError(null);
    setLocating(true);
    setGeoHint("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupLatStr(lat.toFixed(6));
        setPickupLngStr(lng.toFixed(6));

        try {
          const geo = await reverseGeocodePickup(lat, lng);
          setGeoError(null);
          setPickupLatStr(geo.lat.toFixed(6));
          setPickupLngStr(geo.lng.toFixed(6));
          setPickupAddress(geo.displayName);
          setGeoHint("success");
        } catch (e: unknown) {
          setPickupAddress("");
          const msg =
            e instanceof ApiError ? e.message : t("public.orderExperience.geoReverseFail");
          setGeoError(msg);
          setGeoHint("idle");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setGeoHint("idle");
        const code = (err && "code" in err ? err.code : undefined) as number | undefined;
        const msg =
          code === 1
            ? t("public.orderExperience.geoPermissionDenied")
            : code === 2
              ? t("public.orderExperience.geoUnavailable")
              : code === 3
                ? t("public.orderExperience.geoTimeout")
                : t("public.orderExperience.geoGeneric");
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [t]);

  const scrollToOrder = () => orderSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submitComplaint = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (
      !complaintName.trim() ||
      !complaintPhone.trim() ||
      !complaintType.trim() ||
      !complaintMessage.trim()
    ) {
      return;
    }
    setComplaintAlert(null);
    setComplaintSubmitting(true);
    try {
      await submitPublicComplaint(ownerCode.trim(), {
        customerName: complaintName.trim(),
        customerPhone: complaintPhone.trim(),
        complaintType: complaintType.trim(),
        message: complaintMessage.trim(),
      });
      setComplaintAlert({ tone: "ok", message: t("public.orderExperience.complaintSentOk") });
      setComplaintMessage("");
      setComplaintType("");
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message.trim() !== ""
          ? e.message
          : t("public.orderExperience.complaintSentFail");
      setComplaintAlert({ tone: "err", message: msg });
    } finally {
      setComplaintSubmitting(false);
    }
  };

  /** Prepared for wiring — calls real `createPublicOrder` with existing payload rules. */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pickupAddress.trim() || !dropoffAddress.trim() || !senderFullName.trim() || !senderPhone.trim()) return;
    if (!customerFullName.trim()) return;
    setCustomerPhoneError(null);
    const custPhone = customerPhone.trim();
    if (!isReasonableFlexiblePhone(custPhone)) {
      setCustomerPhoneError(t("publicRequest.validation.customerPhoneInvalid"));
      return;
    }
    setComplaintsPageOpen(false);

    const storeAmountNum = parseProductsAmountInput(storeAmountStr);
    if (storeAmountNum === null) {
      onSubmitError?.(t("public.orderExperience.productsAmountRequired"));
      return;
    }

    const feeNum = parseMoneyInput(deliveryFeePreview);
    const pkgLabel = t(`public.packageTypes.${packageTypeId}`);
    const packageNotes = pkgLabel.trim() ? t("public.orderExperience.packageTypeInNotes", { type: pkgLabel }) : "";
    const notesCombined = [packageNotes, notesExtra.trim()].filter(Boolean).join(" | ");
    const pickupLatitude = pickupLatStr.trim() ? Number(pickupLatStr) : undefined;
    const pickupLongitude = pickupLngStr.trim() ? Number(pickupLngStr) : undefined;

    onBannerConsumed?.();
    setSubmitting(true);
    setStep("tracking");

    const body = {
      ownerCode: ownerCode.trim(),
      senderFullName: senderFullName.trim(),
      senderPhone: senderPhone.trim(),
      customerName: customerFullName.trim(),
      customerPhone: custPhone,
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      area: dropoffAddress.trim() || "General",
      amount: storeAmountNum,
      ...(notesCombined ? { notes: notesCombined } : {}),
      ...(Number.isFinite(pickupLatitude) ? { pickupLatitude } : {}),
      ...(Number.isFinite(pickupLongitude) ? { pickupLongitude } : {}),
      ...(selectedZoneId ? { zoneId: selectedZoneId } : {}),
    };

    try {
      const created = await createPublicOrder(body);
      persistSenderPickupProfileGate();
      const receipt = buildReceipt(created, {
        storeNum: storeAmountNum,
        feePreview: feeNum,
        pickupLatitude,
        pickupLongitude,
        ownerCode: ownerCode.trim(),
      });
      onSuccess(receipt);
    } catch (e: unknown) {
      setStep("form");
      const fallback = t("public.orderExperience.orderSubmitFailedBanner");
      if (e instanceof ApiError) {
        onSubmitError?.(e.message.trim() !== "" ? e.message : fallback);
      } else {
        onSubmitError?.(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  function onPhotoPick(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0] ?? null;
    setPhotoFile(f);
    if (photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    setPhotoPreviewUrl(f ? URL.createObjectURL(f) : null);
    // Prepared for multipart upload later (state only)
  }

  const displayCompanyTitle = ctx.company?.name?.trim() ? ctx.company.name.trim() : t("public.defaultCompanyTitle");

  const goToOrderStep2 = () => {
    setSenderPhoneError(null);
    if (!pickupAddress.trim() || !senderFullName.trim() || !senderPhone.trim()) return;
    const sp = senderPhone.trim();
    if (!isReasonableFlexiblePhone(sp)) {
      setSenderPhoneError(t("publicRequest.validation.senderPhoneInvalid"));
      return;
    }
    persistSenderPickupProfileGate();
    setOrderWizardStep(2);
  };

  const closeComplaintsPage = useCallback(() => setComplaintsPageOpen(false), []);

  const openComplaintsPage = useCallback(() => {
    setMenuOpen(false);
    setComplaintsPageOpen(true);
  }, []);

  return (
    <div
      className={`min-h-screen bg-muted/15 font-['IBM_Plex_Sans_Arabic',system-ui,sans-serif] ${rtl ? "rtl:text-right" : ""}`}
      dir={rtl ? "rtl" : "ltr"}
    >
      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label={t("public.orderExperience.closeMenu")}
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className={`fixed top-0 z-50 flex h-full w-[min(288px,90vw)] flex-col gap-4 border-gray-100 bg-white p-5 pt-24 shadow-xl ${
              rtl ? "right-0 border-s" : "left-0 border-e"
            }`}
          >
            <p className="text-sm font-bold text-slate-900">{t("public.orderExperience.settings")}</p>
            <LanguageSwitcher />
            <button
              type="button"
              className="mt-auto text-sm font-medium text-primary underline"
              onClick={() => setMenuOpen(false)}
            >
              {t("public.orderExperience.closeMenu")}
            </button>
          </aside>
        </>
      ) : null}

      <header className="sticky top-0 z-30 shrink-0 border-b border-[color:var(--brand-border)] bg-white/98 backdrop-blur-md">
        <div className="mx-auto flex h-[52px] max-w-md items-center gap-1 px-2 sm:px-4">
          {complaintsPageOpen ? (
            <button
              type="button"
              className="-ms-1 rounded-2xl p-2 text-primary hover:bg-[color:var(--brand-light-primary)]"
              aria-label={t("public.orderExperience.complaintsBackAria")}
              onClick={closeComplaintsPage}
            >
              <ArrowLeft className={`size-7 shrink-0 stroke-[2.25] ${rtl ? "rotate-180" : ""}`} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="-ms-1 rounded-2xl p-2 text-primary hover:bg-[color:var(--brand-light-primary)]"
              aria-label={t("public.orderExperience.menuAria")}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="size-7 shrink-0 stroke-[2.25]" aria-hidden />
            </button>
          )}

          <div className="min-w-0 flex-1 text-center">
            <div className="mx-auto inline-flex max-w-[min(100%,16rem)] items-center rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-[color:var(--brand-border)] ring-offset-0 sm:max-w-[min(100%,18rem)]">
              <span className="truncate text-[15px] font-bold leading-snug tracking-tight text-primary sm:text-base">
                {complaintsPageOpen ? t("public.orderExperience.complaintsTitle") : displayCompanyTitle}
              </span>
            </div>
          </div>

          {showComplaintsUi && !complaintsPageOpen ? (
            <button
              type="button"
              className="rounded-2xl p-2 text-primary hover:bg-[color:var(--brand-light-primary)]"
              aria-label={t("public.orderExperience.complaintsAria")}
              onClick={openComplaintsPage}
            >
              <MessageSquare className="size-7 shrink-0 stroke-[2.25]" aria-hidden />
            </button>
          ) : null}

          <button
            type="button"
            disabled
            className="relative -me-1 cursor-not-allowed rounded-2xl p-2 text-primary/35 opacity-60"
            aria-label={t("public.orderExperience.notificationsUnavailableAria")}
            title={t("public.orderExperience.notificationsUnavailableAria")}
          >
            <Bell className="size-7 shrink-0" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 pb-10 pt-3 sm:px-4 lg:max-w-md">
        <AnimatePresence>
          {bannerError && step !== "tracking" && !complaintsPageOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {bannerError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {step !== "tracking" && !complaintsPageOpen ? (
          <>
            {ctx.publicPage?.introTitle ? (
              <p className="mb-2 text-center text-[15px] font-bold text-primary">{ctx.publicPage.introTitle}</p>
            ) : null}
            {ctx.publicPage?.introSubtitle ? (
              <p className="mb-5 text-center text-[13px] leading-relaxed text-slate-600">{ctx.publicPage.introSubtitle}</p>
            ) : null}
          </>
        ) : null}

        {step === "tracking" ? (
          <TrackingPanel submitting={submitting} />
        ) : complaintsPageOpen && showComplaintsUi ? (
          <div className="space-y-4 pb-6">
            <form id="public-complaints-section" className="space-y-4" onSubmit={submitComplaint}>
              <div className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-5 shadow-[0_4px_28px_-12px_rgba(142,27,27,0.06)] sm:p-7">
                <h2 className="sr-only">{t("public.orderExperience.complaintsTitle")}</h2>
                <p className="mb-6 text-sm text-muted-foreground">{t("public.orderExperience.complaintsLead")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("public.orderExperience.complaintNameLabel")}>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                      <input
                        required
                        value={complaintName}
                        onChange={(e) => setComplaintName(e.target.value)}
                        className={`${INPUT_CLASS} pl-10 rtl:pl-4 rtl:pr-10`}
                        placeholder={t("public.orderExperience.complaintSenderNamePlaceholder")}
                      />
                    </div>
                  </Field>
                  <Field label={t("public.phone")}>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                      <input
                        required
                        dir="ltr"
                        value={complaintPhone}
                        onChange={(e) => setComplaintPhone(e.target.value)}
                        className={`${INPUT_CLASS} pl-10 text-left rtl:pl-4 rtl:pr-10`}
                        placeholder=""
                      />
                    </div>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label={t("public.orderExperience.complaintTypeLabel")}>
                    <input
                      required
                      value={complaintType}
                      onChange={(e) => setComplaintType(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder={t("public.orderExperience.complaintTypePlaceholder")}
                    />
                  </Field>
                </div>
                <div className="relative mt-4">
                  <Field label={t("public.orderExperience.complaintDetailLabel")}>
                    <div className="relative">
                      <AlignLeft className="pointer-events-none absolute left-3 top-3 size-4 text-primary/85 rtl:left-auto rtl:right-3" />
                      <textarea
                        required
                        value={complaintMessage}
                        onChange={(e) => setComplaintMessage(e.target.value)}
                        rows={4}
                        className={`${INPUT_CLASS} resize-y pl-10 rtl:pl-4 rtl:pr-10`}
                        placeholder={t("public.orderExperience.complaintMessagePlaceholder")}
                      />
                    </div>
                  </Field>
                </div>
                {complaintAlert ? (
                  <p className={`mt-4 text-sm ${complaintAlert.tone === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                    {complaintAlert.message}
                  </p>
                ) : null}
                <div className="mt-8">
                  <motion.button
                    type="submit"
                    disabled={complaintSubmitting}
                    whileTap={{ scale: complaintSubmitting ? 1 : 0.98 }}
                    className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[1.05rem] bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-[0_8px_24px_-6px_rgba(198,40,40,0.38)] transition hover:bg-[color:var(--brand-primary-dark)] disabled:opacity-65"
                  >
                    {complaintSubmitting ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-5" aria-hidden />
                    )}
                    {t("public.orderExperience.submitComplaint")}
                  </motion.button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <>
            {ctx.publicPage?.bannerWelcome ? (
              <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-center text-[13px] font-medium text-amber-950">
                {ctx.publicPage.bannerWelcome}
              </div>
            ) : null}

            {showCarouselUi ? (
            <section
              id="public-carousel-section"
              className="overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white shadow-sm"
              aria-label={t("public.orderExperience.carouselAria")}
            >
              <h2 className="sr-only">{t("public.orderExperience.offersSr")}</h2>
              {carouselSlides.length > 0 ? (
                <div className="relative px-10 py-2">
                  {carouselSlides.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="absolute left-1 top-[calc(50%-10px)] z-[2] rounded-full border border-white/90 bg-white p-2 text-primary shadow-sm hover:bg-slate-50 sm:left-2"
                        aria-label={t("public.orderExperience.prevSlide")}
                        onClick={() =>
                          setAdIndex((i) => (i - 1 + carouselSlides.length) % carouselSlides.length)
                        }
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="absolute right-1 top-[calc(50%-10px)] z-[2] rounded-full border border-white/90 bg-white p-2 text-primary shadow-sm hover:bg-slate-50 sm:right-2"
                        aria-label={t("public.orderExperience.nextSlide")}
                        onClick={() => setAdIndex((i) => (i + 1) % carouselSlides.length)}
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    </>
                  ) : null}
                  <div className="mx-auto max-w-xl">
                    <AnimatePresence mode="wait">
                      {activeSlide ? (
                        <motion.div
                          key={activeSlide.id}
                          initial={{ opacity: 0.9 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden rounded-2xl shadow-inner ring-1 ring-black/5"
                        >
                          {activeSlide.imageUrl ? (
                            <img
                              src={activeSlide.imageUrl}
                              alt={activeSlide.alt || activeSlide.title || ""}
                              className="h-[140px] w-full bg-muted/40 object-cover sm:h-[160px]"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div
                              className={`flex min-h-[78px] flex-col justify-center gap-1 bg-gradient-to-br px-4 py-2.5 text-white shadow-inner ${activeSlide.centerBg}`}
                            >
                              <div className="flex items-start justify-between gap-2" dir="rtl">
                                <div className="min-w-0 flex-1">
                                  <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                                    {activeSlide.badge}
                                  </span>
                                  <p className="mt-1 text-[13px] font-extrabold leading-snug sm:text-sm">{activeSlide.title}</p>
                                </div>
                                <span className="shrink-0 text-3xl opacity-95" aria-hidden>
                                  {activeSlide.emoji}
                                </span>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                  {carouselSlides.length > 1 ? (
                    <div className="flex justify-center gap-1.5 pb-2 pt-2">
                      {carouselSlides.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={t("public.orderExperience.slideLabel", { n: i + 1 })}
                          onClick={() => setAdIndex(i)}
                          className={`rounded-full transition-all duration-300 ${
                            i === adIndex ? "h-2 w-7 bg-primary" : "h-1.5 w-1.5 bg-muted/70 hover:bg-primary/35"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <motion.button
                type="button"
                whileTap={{ scale: 0.995 }}
                onClick={scrollToOrder}
                className="flex w-full items-center justify-center gap-2 border-t border-black/10 bg-primary py-3 text-[15px] font-bold text-primary-foreground transition hover:bg-[color:var(--brand-primary-dark)]"
              >
                <ChevronDown className="size-5 opacity-95" aria-hidden />
                {ctx.publicPage?.orderButtonHint?.trim()
                  ? ctx.publicPage.orderButtonHint
                  : t("public.orderExperience.orderFallbackCta")}
              </motion.button>
            </section>
            ) : null}

            <div ref={orderSectionRef} className="scroll-mt-28 space-y-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <motion.section layout className="space-y-3">
                  {orderWizardStep === 1 ? (
                    <>
                      <MapPlaceholder
                        locating={locating}
                        geoHint={geoHint}
                        geoError={geoError}
                        onUseLocation={() => fillPickupFromCurrentLocation()}
                      />

                      {nearbyMapBundle && nearbyMapBundle.points.length > 1 ? (
                        <div className="overflow-hidden rounded-3xl border border-[color:var(--brand-border)] bg-white p-3 shadow-inner">
                          <p className="mb-2 text-center text-[12px] font-semibold text-slate-700">{nearbyMapBundle.caption}</p>
                          <p className="mb-2 text-center text-[11px] text-slate-500">
                            {t("public.orderExperience.nearbyCountsHint", {
                              km: CAPTAIN_MAP_PREVIEW_RADIUS_KM,
                              count: nearbyMapBundle.points.length - 1,
                            })}
                          </p>
                          <PublicTrackingLeaflet className="h-[180px] w-full rounded-2xl" points={nearbyMapBundle.points} />
                        </div>
                      ) : null}

                      {(() => {
                        const platTry = pickupLatStr.trim() ? Number(pickupLatStr) : NaN;
                        const plngTry = pickupLngStr.trim() ? Number(pickupLngStr) : NaN;
                        const partialCoords =
                          pickupLatStr.trim() !== "" || pickupLngStr.trim() !== "";
                        return partialCoords && !isValidLatLng(platTry, plngTry);
                      })() ? (
                        <p
                          role="note"
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[12px] leading-relaxed text-amber-950"
                        >
                          {t("public.orderExperience.nearbyNeedLocationNotice")}
                        </p>
                      ) : null}

                      <div
                        ref={senderPickupStepAnchorRef}
                        className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-5 shadow-[0_6px_32px_-14px_rgba(142,27,27,0.09)] ring-1 ring-primary/[0.07] sm:p-7"
                      >
                        <div className="mb-4">
                          <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
                            {t("public.orderExperience.stepIndicator", { current: 1, total: 2 })}
                          </span>
                        </div>
                        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight text-primary">
                          <ClipboardList className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                          {t("publicRequest.senderSection.title")}
                        </h2>
                        <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
                          {t("publicRequest.senderSection.description")}
                        </p>

                        <div className="space-y-4">
                          <Field label={t("publicRequest.sender.pickupLabel")}>
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                              <input
                                ref={pickupAddressInputRef}
                                required
                                value={pickupAddress}
                                onChange={(e) => setPickupAddress(e.target.value)}
                                placeholder={t("public.orderExperience.pickupPlaceholder")}
                                className={`${INPUT_CLASS} pl-10 rtl:pl-4 rtl:pr-10`}
                              />
                            </div>
                          </Field>

                          <div className="rounded-2xl border border-slate-100/90 bg-[color:var(--brand-light-primary)]/40 p-4 sm:p-5">
                            <p className="text-[13px] font-semibold text-slate-800">{t("public.orderExperience.senderInfoTitle")}</p>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                              {t("public.orderExperience.senderRememberHint")}
                            </p>
                            <div
                              className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
                              role="group"
                              aria-label={t("public.orderExperience.senderProfileActionsGroupAria")}
                            >
                              <button
                                type="button"
                                className="text-[12px] font-semibold text-primary underline underline-offset-2 hover:text-[color:var(--brand-primary-dark)]"
                                onClick={editSavedSenderPickup}
                              >
                                {t("public.orderExperience.senderProfileEditSaved")}
                              </button>
                              <button
                                type="button"
                                className="text-[12px] font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
                                onClick={clearSavedSenderPickup}
                              >
                                {t("public.orderExperience.senderProfileClearSaved")}
                              </button>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <Field label={t("publicRequest.sender.nameLabel")}>
                                <div className="relative">
                                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                                  <input
                                    required
                                    autoComplete="name"
                                    value={senderFullName}
                                    onChange={(e) => {
                                      setSenderFullName(e.target.value);
                                    }}
                                    placeholder={t("publicRequest.sender.namePlaceholder")}
                                    className={`${INPUT_CLASS} pl-10 rtl:pl-4 rtl:pr-10`}
                                  />
                                </div>
                              </Field>
                              <div className="space-y-1.5">
                                <Field label={t("publicRequest.sender.phoneLabel")}>
                                  <div className="relative">
                                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                                    <input
                                      required
                                      dir="ltr"
                                      value={senderPhone}
                                      onChange={(e) => {
                                        setSenderPhone(e.target.value);
                                        setSenderPhoneError(null);
                                      }}
                                      placeholder={t("publicRequest.sender.phonePlaceholder")}
                                      autoComplete="tel"
                                      className={`${INPUT_CLASS} pl-10 text-left rtl:pl-4 rtl:pr-10`}
                                      aria-invalid={senderPhoneError != null || undefined}
                                    />
                                  </div>
                                </Field>
                                {senderPhoneError ? (
                                  <p role="alert" className="text-[11px] font-medium leading-relaxed text-red-700">
                                    {senderPhoneError}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 transition hover:bg-white/95">
                              <input
                                type="checkbox"
                                checked={saveSenderProfileChecked}
                                onChange={(e) => setSaveSenderProfileChecked(e.target.checked)}
                                className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary/30"
                              />
                              <span className="text-[13px] font-medium leading-snug text-slate-800">
                                {t("public.orderExperience.senderProfileSaveCheckbox")}
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={goToOrderStep2}
                            className="inline-flex w-full items-center justify-center rounded-[1.25rem] bg-primary px-8 py-3.5 text-base font-extrabold text-primary-foreground shadow-[0_10px_28px_-8px_rgba(198,40,40,0.35)] transition-colors hover:bg-[color:var(--brand-primary-dark)] sm:w-auto sm:min-w-[180px]"
                          >
                            {t("publicRequest.actions.nextCustomer")}
                          </motion.button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-5 shadow-[0_6px_32px_-14px_rgba(142,27,27,0.09)] ring-1 ring-primary/[0.07] sm:p-7">
                        <div className="mb-4">
                          <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
                            {t("public.orderExperience.stepIndicator", { current: 2, total: 2 })}
                          </span>
                        </div>
                        <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-primary">
                          <MapPin className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                          {t("publicRequest.customerSection.title")}
                        </h2>
                        <p className="mb-6 text-[13px] leading-relaxed text-slate-700">
                          {t("publicRequest.customerSection.description")}
                        </p>

                        <div className="space-y-4">
                          <Field label={t("publicRequest.customer.nameLabel")}>
                            <div className="relative">
                              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                              <input
                                required
                                autoComplete="name"
                                value={customerFullName}
                                onChange={(e) => setCustomerFullName(e.target.value)}
                                placeholder={t("publicRequest.customer.namePlaceholder")}
                                className={`${INPUT_CLASS} pl-10 rtl:pl-4 rtl:pr-10`}
                              />
                            </div>
                          </Field>
                          <div className="space-y-1.5">
                            <Field label={t("publicRequest.customer.phoneLabel")}>
                              <div className="relative">
                                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/85 rtl:left-auto rtl:right-3" />
                                <input
                                  type="tel"
                                  required
                                  inputMode="tel"
                                  dir="ltr"
                                  autoComplete="tel"
                                  value={customerPhone}
                                  onChange={(e) => {
                                    setCustomerPhone(e.target.value);
                                    setCustomerPhoneError(null);
                                  }}
                                  placeholder={t("publicRequest.customer.phonePlaceholder")}
                                  className={`${INPUT_CLASS} pl-10 rtl:pl-4 rtl:pr-10 text-left`}
                                  aria-invalid={customerPhoneError != null || undefined}
                                />
                              </div>
                            </Field>
                            {customerPhoneError ? (
                              <p role="alert" className="text-[11px] font-medium leading-relaxed text-red-700">
                                {customerPhoneError}
                              </p>
                            ) : null}
                          </div>

                          <Field label={t("publicRequest.customer.deliveryLabel")}>
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-3 top-3 size-4 text-primary/85 rtl:left-auto rtl:right-3" />
                              <textarea
                                required
                                rows={3}
                                value={dropoffAddress}
                                onChange={(e) => setDropoffAddress(e.target.value)}
                                placeholder={t("public.orderExperience.dropoffPlaceholder")}
                                className={`${INPUT_CLASS} min-h-[5.25rem] resize-y pl-10 rtl:pl-4 rtl:pr-10`}
                              />
                            </div>
                          </Field>

                          <Field label={t("public.orderExperience.packageTypeLabel")}>
                            <div className="flex flex-wrap gap-2">
                              {PACKAGE_OPTIONS.map(({ id, Icon }) => {
                                const sel = packageTypeId === id;
                                const label = t(`public.packageTypes.${id}`);
                                return (
                                  <motion.button
                                    key={id}
                                    type="button"
                                    aria-pressed={sel}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setPackageTypeId(id)}
                                    className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
                                      sel
                                        ? "border-primary bg-[color:var(--brand-light-primary)] text-[color:var(--brand-primary-dark)] shadow-sm ring-[3px] ring-primary/25"
                                        : "border-gray-100 bg-gray-50/90 text-slate-700 hover:border-[color:var(--brand-border)]"
                                    }`}
                                  >
                                    <Icon className="size-4 shrink-0" />
                                    {label}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </Field>

                          <Field label={t("public.orderExperience.notesOptionalLabel")}>
                            <input
                              value={notesExtra}
                              onChange={(e) => setNotesExtra(e.target.value)}
                              placeholder={t("public.orderExperience.notesPlaceholder")}
                              className={INPUT_CLASS}
                            />
                          </Field>

                          {ctx.zones?.length ? (
                            <Field label={t("public.orderExperience.zoneOptionalLabel")}>
                              <select
                                value={selectedZoneId}
                                onChange={(e) => setSelectedZoneId(e.target.value)}
                                className={INPUT_CLASS}
                              >
                                <option value="">{t("public.orderExperience.zoneNone")}</option>
                                {ctx.zones.map((z) => (
                                  <option key={z.id} value={z.id}>
                                    {z.cityName} — {z.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : null}
                        </div>
                        <CaptainAvailabilityBanner state={captainAvailabilityState} />
                      </div>

                      <div className="rounded-3xl border border-dashed border-[color:var(--brand-border)] bg-white p-5 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] sm:p-7">
                        <p className="mb-4 text-sm font-semibold text-slate-900">{t("public.orderExperience.parcelPhotoTitle")}</p>
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--brand-border)] bg-[color:var(--brand-light-primary)] px-4 py-6 text-center text-sm text-slate-600 transition hover:bg-[color:var(--brand-light-accent)]">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onPhotoPick}
                          />
                          <Upload className="size-8 text-primary" aria-hidden />
                          <span>{t("public.orderExperience.parcelPhotoBrowse")}</span>
                        </label>
                        {photoPreviewUrl ? (
                          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                            <img
                              src={photoPreviewUrl}
                              alt=""
                              className="mt-4 max-h-40 w-auto rounded-xl border border-gray-100 object-cover shadow-inner"
                            />
                          </motion.div>
                        ) : null}
                        <p className="mt-3 text-[11px] text-slate-400">
                          {photoFile ? `${t("public.orderExperience.parcelPhotoChosen")} ${photoFile.name}` : null}
                        </p>
                        <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
                          {t("public.orderExperience.parcelPhotoNotSentNote")}
                        </p>
                      </div>

                      <PricingCard
                        productAmountStr={storeAmountStr}
                        onProductAmountChange={setStoreAmountStr}
                        deliveryFeePreview={deliveryFeePreview}
                        estimatedTotal={estimatedTotal}
                        pricingMode={ctx.pricing.mode}
                        formulaHint={ctx.pricing.formulaHint ?? null}
                        baseDeliveryFee={ctx.pricing.baseDeliveryFee ?? null}
                        pricePerKm={ctx.pricing.pricePerKm ?? null}
                      />

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setOrderWizardStep(1)}
                          className="order-2 inline-flex items-center justify-center rounded-2xl border-2 border-[color:var(--brand-border)] bg-white px-6 py-3.5 text-sm font-bold text-primary sm:order-1"
                        >
                          {t("public.orderExperience.prevStep")}
                        </motion.button>
                        <motion.button
                          type="submit"
                          disabled={submitting}
                          whileHover={{ scale: submitting ? 1 : 1.02 }}
                          whileTap={{ scale: submitting ? 1 : 0.98 }}
                          className="order-1 inline-flex flex-1 items-center justify-center rounded-[1.25rem] bg-primary px-8 py-4 text-lg font-extrabold text-primary-foreground shadow-[0_10px_28px_-8px_rgba(198,40,40,0.38)] transition-colors hover:bg-[color:var(--brand-primary-dark)] disabled:opacity-70 sm:order-2 sm:max-w-none sm:flex-initial sm:min-w-[240px]"
                        >
                          {submitting ? t("public.submitting") : t("publicRequest.actions.submitOrder")}
                        </motion.button>
                      </div>
                    </>
                  )}
                </motion.section>
              </form>

              {showBenefitsUi ? (
              <section className="grid gap-3 pb-4 sm:grid-cols-3 sm:gap-4" aria-labelledby="benefits-heading">
                <h2 id="benefits-heading" className="sr-only">
                  {t("public.orderExperience.benefitsHeading")}
                </h2>
                <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 text-center shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
                  <Zap className="mx-auto mb-2 size-9 text-primary" aria-hidden />
                  <p className="text-sm font-bold text-primary">{t("public.orderExperience.benefitFast")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("public.orderExperience.benefitFastDesc")}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 text-center shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
                  <Map className="mx-auto mb-2 size-9 text-primary" aria-hidden />
                  <p className="text-sm font-bold text-primary">{t("public.orderExperience.benefitLive")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("public.orderExperience.benefitLiveDesc")}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 text-center shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)]">
                  <ShieldCheck className="mx-auto mb-2 size-9 text-primary" aria-hidden />
                  <p className="text-sm font-bold text-primary">{t("public.orderExperience.benefitSafe")}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("public.orderExperience.benefitSafeDesc")}</p>
                </div>
              </section>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-sm text-slate-800 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20 placeholder:text-slate-400";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-semibold tracking-tight text-slate-600">{label}</label>
      {children}
      {hint ? (
        <p id={hintId} className="text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MapPlaceholder({
  locating,
  geoHint,
  geoError,
  onUseLocation,
}: {
  locating: boolean;
  geoHint: "idle" | "loading" | "success";
  geoError: string | null;
  onUseLocation: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-5 shadow-[0_4px_28px_-12px_rgba(142,27,27,0.06)] sm:p-7">
      <h2 className="text-lg font-bold text-primary">{t("public.orderExperience.locateHeading")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("public.orderExperience.locateSub")}</p>
    <motion.div layout className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 shadow-inner">
      <div className="relative min-h-[140px] w-full overflow-hidden rounded-t-2xl border-b border-gray-100 sm:min-h-[168px]">
        <motion.div aria-hidden className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <motion.div aria-hidden className="absolute inset-0 opacity-30">
          <svg viewBox="0 0 400 240" className="size-full">
            <path
              d="M 40 170 Q 140 110 260 145 T 360 125"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
        <motion.div className="absolute left-1/2 top-[45%] z-[2] flex -translate-x-1/2 -translate-y-1/2">
          <MapPin className="size-12 shrink-0 text-primary drop-shadow-md sm:size-14" aria-hidden />
        </motion.div>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-white/95 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <motion.button
            type="button"
            disabled={locating}
            whileTap={{ scale: 0.99 }}
            onClick={onUseLocation}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-white px-5 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-[color:var(--brand-light-primary)] disabled:opacity-60"
          >
            {locating ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
            {t("public.orderExperience.locateButton")}
          </motion.button>
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col gap-2 text-xs text-gray-600">
          <p>{geoHint === "loading" ? t("public.orderExperience.geoLoadingHint") : null}</p>
          <p>{geoHint === "success" ? t("public.orderExperience.geoSuccessHint") : null}</p>
          <p>{geoHint === "idle" && !locating ? t("public.orderExperience.geoIdleMapHint") : null}</p>
          {geoError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">{geoError}</p> : null}
        </div>
      </div>
    </motion.div>
    </section>
  );
}

function PricingCard(props: {
  productAmountStr: string;
  onProductAmountChange: (v: string) => void;
  deliveryFeePreview: string;
  estimatedTotal: string | null;
  pricingMode: string;
  formulaHint: string | null;
  baseDeliveryFee: string | null;
  pricePerKm: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-6 shadow-[0_4px_24px_-10px_rgba(198,40,40,0.1)]">
      <h3 className="mb-5 text-lg font-bold text-primary">{t("public.orderExperience.pricingHeading")}</h3>
      <div className="space-y-3 text-sm">
        <Row label={t("public.orderExperience.productsAmountLabel")} emphasize>
          <label className="sr-only" htmlFor="productQty">
            {t("public.orderExperience.productsAmountLabel")}
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2">
            <span className="text-slate-500">₪</span>
            <input
              id="productQty"
              type="text"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              placeholder={t("public.orderExperience.productsAmountPlaceholder")}
              value={props.productAmountStr}
              onChange={(e) => props.onProductAmountChange(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-right outline-none ring-0 placeholder:text-slate-400"
            />
          </div>
        </Row>
        <Row label={t("public.orderExperience.deliveryFeeRowNote")} emphasize={false}>
          <span dir="ltr" className="font-semibold tabular-nums">
            ₪ {props.deliveryFeePreview}
          </span>
        </Row>
        <div className="border-t border-dashed pt-4">
          <div className="flex items-center justify-between text-lg font-bold text-[color:var(--brand-primary-dark)]">
            <span>{t("public.orderExperience.estimatedTotalRow")}</span>
            <span dir="ltr" className={`tabular-nums ${props.estimatedTotal == null ? "text-base font-semibold text-slate-500" : ""}`}>
              {props.estimatedTotal == null ? (
                <span aria-live="polite">{t("public.orderExperience.productsTotalPending")}</span>
              ) : (
                <>₪ {props.estimatedTotal}</>
              )}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {props.pricingMode === "FIXED" ? (
              <>
                {t("public.orderExperience.pricingFixedNote")} {t("public.orderExperience.pricingServerFinal")}
              </>
            ) : (
              <>
                {t("public.orderExperience.pricingDynamicNote")}
                {props.formulaHint
                  ? ` (${props.formulaHint})`
                  : props.baseDeliveryFee && props.pricePerKm
                    ? ` · ₪${props.baseDeliveryFee} + ₪${props.pricePerKm}/km`
                    : ""}
                . {t("public.orderExperience.pricingServerFinal")}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, emphasize, children }: { label: string; emphasize?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${emphasize ? "font-semibold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span>
      <div className={`text-right ${emphasize ? "text-slate-900" : ""}`}>{children}</div>
    </div>
  );
}

function TrackingPanel({ submitting }: { submitting: boolean }) {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-10 text-center shadow-sm">
        <motion.div
          className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-[color:var(--brand-light-primary)] ring-8 ring-primary/15"
          animate={
            submitting
              ? {
                  scale: [1, 1.08, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(198, 40, 40, 0.35)",
                    "0 0 0 28px rgba(198, 40, 40, 0)",
                    "0 0 0 0 rgba(198, 40, 40, 0.35)",
                  ],
                }
              : {}
          }
          transition={submitting ? { repeat: Infinity, duration: 1.35, ease: "easeOut" } : {}}
        >
          <Navigation className="size-10 text-primary" />
        </motion.div>
        <h2 className="text-xl font-bold text-slate-900">
          {submitting ? t("public.orderExperience.trackingSearching") : t("public.orderExperience.trackingFinalizing")}
        </h2>
        {submitting ? (
          <p className="mt-2 text-sm text-slate-500">{t("public.orderExperience.trackingKeepOpen")}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[color:var(--brand-border)] bg-[color:var(--brand-light-primary)] p-6 text-center shadow-inner">
        <p className="text-sm font-semibold text-[color:var(--brand-primary-dark)]">{t("public.orderExperience.trackingFindingTitle")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("public.orderExperience.trackingWaitHint")}</p>
      </div>
    </motion.div>
  );
}

const PUBLIC_SUCCESS_TIMELINE = [
  "PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
] as const;

const TIMELINE_I18N_KEY: Record<(typeof PUBLIC_SUCCESS_TIMELINE)[number], string> = {
  PENDING: "successTimeline_pending",
  CONFIRMED: "successTimeline_confirmed",
  ASSIGNED: "successTimeline_assigned",
  ACCEPTED: "successTimeline_accepted",
  PICKED_UP: "successTimeline_picked",
  IN_TRANSIT: "successTimeline_transit",
  DELIVERED: "successTimeline_delivered",
};

/** بعد الإرسال — تتبّع حي عبر اللوحة (OSRM) وروابط الويز لمتابعة مسار الكابتن؛ الخريطة OSM وليست Google المضمّنة. */
export function PublicRequestSuccessStage({
  receipt,
  onNewOrder,
  rtl,
}: {
  receipt: ReceiptState;
  onNewOrder: () => void;
  rtl: boolean;
}) {
  const { t } = useTranslation();
  const [live, setLive] = useState<PublicOrderTrackingResult | null>(null);
  /** Present when the latest tracking poll failed — last successful `live` is kept. */
  const [trackingPollFailure, setTrackingPollFailure] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [delayed3Minutes, setDelayed3Minutes] = useState(false);
  /** Last count when preview was fetched at 5 km (null until first nearby response resolves). */
  const [captainsNearbyAtFive, setCaptainsNearbyAtFive] = useState<number | null>(null);
  const [nearbyPreviewPts, setNearbyPreviewPts] = useState<MapPoint[]>([]);

  useEffect(() => {
    const tok = receipt.trackingToken;
    if (!tok || !receipt.orderId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await fetchPublicOrderTracking(receipt.ownerCode, receipt.orderId, tok);
        if (!cancelled) {
          setLive(next);
          setTrackingPollFailure(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : t("public.orderExperience.trackingPollFailedUnknown");
          const status = e instanceof ApiError ? e.status : undefined;
          setTrackingPollFailure({ message, status });
        }
      }
    };
    void poll();
    const id = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [receipt.ownerCode, receipt.orderId, receipt.trackingToken, t]);

  const effectiveStatus = live?.status ?? receipt.status;
  const statusIndex = PUBLIC_SUCCESS_TIMELINE.findIndex((s) => s === effectiveStatus);

  const pickupCoordsForNearby = useMemo(() => {
    const la = live?.pickupLat;
    const lo = live?.pickupLng;
    if (Number.isFinite(la ?? NaN) && Number.isFinite(lo ?? NaN))
      return { lat: Number(la), lng: Number(lo) };
    if (hasCoordsUi(receipt.pickupLatitude, receipt.pickupLongitude)) {
      return { lat: Number(receipt.pickupLatitude), lng: Number(receipt.pickupLongitude) };
    }
    return null;
  }, [
    live?.pickupLat,
    live?.pickupLng,
    receipt.pickupLatitude,
    receipt.pickupLongitude,
  ]);

  const awaitingCaptainAssignment = useMemo(() => {
    if (effectiveStatus === "DELIVERED" || effectiveStatus === "CANCELLED") return false;
    return !live?.captain;
  }, [effectiveStatus, live?.captain]);

  useEffect(() => {
    if (!awaitingCaptainAssignment) return;
    const id = window.setTimeout(() => setDelayed3Minutes(true), SUCCESS_WAIT_EXPAND_MS);
    return () => clearTimeout(id);
  }, [awaitingCaptainAssignment]);

  const nearbyPreviewRadiusKm = useMemo(() => {
    if (!awaitingCaptainAssignment) return SUCCESS_WAIT_NEARBY_INITIAL_KM;
    if (delayed3Minutes && captainsNearbyAtFive === 0) return SUCCESS_WAIT_NEARBY_EXPANDED_KM;
    return SUCCESS_WAIT_NEARBY_INITIAL_KM;
  }, [awaitingCaptainAssignment, delayed3Minutes, captainsNearbyAtFive]);

  const trackingPollStatusHint = useMemo(() => {
    const s = trackingPollFailure?.status;
    if (s === 404) return t("public.orderExperience.trackingPollFailedReason404");
    if (s === 401 || s === 403) return t("public.orderExperience.trackingPollFailedReason403");
    if (typeof s === "number" && s >= 500) return t("public.orderExperience.trackingPollFailedReason5xx");
    if (s === undefined || s === 0) return t("public.orderExperience.trackingPollFailedReasonNetwork");
    return t("public.orderExperience.trackingPollFailedReasonGeneric");
  }, [trackingPollFailure?.status, t]);

  useEffect(() => {
    if (!awaitingCaptainAssignment) {
      setNearbyPreviewPts([]);
      setCaptainsNearbyAtFive(null);
      return;
    }
    let cancelled = false;
    const { lat: plat, lng: plng } = pickupCoordsForNearby ?? { lat: NaN, lng: NaN };
    if (!isValidLatLng(plat, plng)) {
      setNearbyPreviewPts([]);
      return;
    }
    const captionRadius = nearbyPreviewRadiusKm;
    const tid = window.setTimeout(() => {
      void fetchNearbyCaptains(receipt.ownerCode, plat, plng, captionRadius)
        .then((data) => {
          if (cancelled) return;
          if (captionRadius === SUCCESS_WAIT_NEARBY_INITIAL_KM) {
            setCaptainsNearbyAtFive(data.captains.length);
          }
          const pts: MapPoint[] = data.captains.map((c, i) => ({
            lat: c.latitude,
            lng: c.longitude,
            label: t("public.orderExperience.captainMarkerLine", {
              label: c.label,
              dist: c.distanceKm,
              vehicle: c.vehicleType,
            }),
            color: CAPT_NEARBY_COLORS[i % CAPT_NEARBY_COLORS.length] ?? "#c62828",
          }));
          setNearbyPreviewPts(pts);
        })
        .catch(() => {
          if (cancelled) return;
          setNearbyPreviewPts([]);
          if (captionRadius === SUCCESS_WAIT_NEARBY_INITIAL_KM) {
            setCaptainsNearbyAtFive(0);
          }
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [awaitingCaptainAssignment, pickupCoordsForNearby, receipt.ownerCode, nearbyPreviewRadiusKm, t]);

  const livePoints = useMemo((): MapPoint[] => {
    const pts: MapPoint[] = [];
    const cap = live?.captain;
    if (live && cap && Number.isFinite(cap.latitude) && Number.isFinite(cap.longitude)) {
      pts.push({
        lat: cap.latitude,
        lng: cap.longitude,
        label:
          `${cap.displayName}${cap.phoneMasked && cap.phoneMasked !== "—" ? ` (${cap.phoneMasked})` : ""}`,
        color: "#c62828",
      });
    }
    if (live?.pickupLat != null && live?.pickupLng != null) {
      pts.push({
        lat: live.pickupLat,
        lng: live.pickupLng,
        label: t("public.orderExperience.captainPickupEst"),
        color: "#10b981",
      });
    } else if (hasCoordsUi(receipt.pickupLatitude, receipt.pickupLongitude)) {
      pts.push({
        lat: Number(receipt.pickupLatitude),
        lng: Number(receipt.pickupLongitude),
        label: t("public.orderExperience.captainPickupFromOrder"),
        color: "#10b981",
      });
    }
    if (live?.dropoffLat != null && live?.dropoffLng != null) {
      pts.push({
        lat: live.dropoffLat,
        lng: live.dropoffLng,
        label: t("public.orderExperience.captainDropFinal"),
        color: "#f97316",
      });
    } else if (hasCoordsUi(receipt.dropoffLatitude, receipt.dropoffLongitude)) {
      pts.push({
        lat: Number(receipt.dropoffLatitude),
        lng: Number(receipt.dropoffLongitude),
        label: t("public.orderExperience.captainDropFromOrder"),
        color: "#f97316",
      });
    }
    return pts;
  }, [live, receipt, t]);

  const mapLeafletPoints = useMemo(() => {
    if (awaitingCaptainAssignment && !live?.captain && nearbyPreviewPts.length > 0) {
      return [...nearbyPreviewPts, ...livePoints];
    }
    return livePoints;
  }, [awaitingCaptainAssignment, live?.captain, nearbyPreviewPts, livePoints]);

  return (
    <div className="min-h-screen bg-muted/20" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-end gap-4 px-4 pt-8">
        <LanguageSwitcher />
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <div className="rounded-3xl border border-[color:var(--brand-border)] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-[color:var(--brand-primary-dark)] sm:text-2xl">
            {t("public.orderExperience.successTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t("public.orderExperience.successMapNote")}</p>
          {awaitingCaptainAssignment ? (
            <div
              role="status"
              className="mt-5 flex gap-3 rounded-2xl border-2 border-amber-300/90 bg-amber-50/95 px-4 py-3.5 text-amber-950 shadow-sm"
            >
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug">
                  {t("public.orderExperience.waitingStayOnPageTitle")}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-amber-950/90">
                  {t("public.orderExperience.waitingStayOnPageDetail")}
                </p>
              </div>
            </div>
          ) : null}
          <div className="mt-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm">
            <p className="font-semibold text-slate-900">#{receipt.orderNumber}</p>
            <dl className="grid gap-1 text-muted-foreground">
              <div className="flex justify-between gap-4 border-b border-white/70 py-2">
                <dt>{t("public.orderExperience.storesLabel")}</dt>
                <dd dir="ltr" className="font-medium text-slate-900 tabular-nums">
                  ₪ {receipt.store}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/70 py-2">
                <dt>{t("public.orderExperience.deliveryFeeReceipt")}</dt>
                <dd dir="ltr" className="font-medium tabular-nums">
                  ₪ {receipt.fee}
                </dd>
              </div>
              <div className="flex justify-between gap-4 pt-2">
                <dt>{t("public.orderExperience.collectLabel")}</dt>
                <dd dir="ltr" className="font-bold text-[color:var(--brand-primary-dark)] tabular-nums">
                  ₪ {receipt.collect}
                </dd>
              </div>
            </dl>
            <p className="pt-4 text-[13px] text-slate-500">
              {t("public.orderExperience.pickupLine")} {receipt.pickupAddress}
              <br />
              {t("public.orderExperience.dropLine")} {receipt.dropoffAddress}
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-[color:var(--brand-border)] bg-[color:var(--brand-light-primary)] p-5">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-primary-dark)]">
              {t("public.orderExperience.liveTrackSection")}
            </p>
            {trackingPollFailure ? (
              <div
                role="alert"
                className="mb-4 flex gap-3 rounded-2xl border border-red-300/85 bg-red-50 px-4 py-3 text-red-950 shadow-sm"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-[13px] font-semibold leading-snug">
                    {t("public.orderExperience.trackingPollFailedBanner")}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed opacity-95">{trackingPollStatusHint}</p>
                  {typeof trackingPollFailure.status === "number" && trackingPollFailure.status > 0 ? (
                    <p className="mt-1 font-mono text-[11px] text-red-900/85" dir="ltr">
                      HTTP {trackingPollFailure.status}
                    </p>
                  ) : null}
                  {trackingPollFailure.message.trim() !== "" ? (
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white/70 px-2 py-1.5 text-[12px] text-red-950/95" dir="auto">
                      {trackingPollFailure.message}
                    </p>
                  ) : null}
                  {live ? (
                    <p className="mt-3 text-[11px] leading-relaxed text-red-950/85">
                      {t("public.orderExperience.trackingPollFailedStaleNotice")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!receipt.trackingToken ? (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-center text-[12px] text-amber-950">
                {t("public.orderExperience.trackingPollNoTokenNotice")}
              </p>
            ) : null}
            {live?.captain?.wazeUrl ? (
              <div className="mb-4 flex justify-center">
                <a
                  href={live.captain.wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-[#33CCFF] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-inner hover:opacity-95"
                >
                  {t("public.orderExperience.wazeCta")}
                </a>
              </div>
            ) : (
              <p className="mb-4 text-center text-[12px] text-slate-600">{t("public.orderExperience.wazePending")}</p>
            )}
            {awaitingCaptainAssignment && pickupCoordsForNearby && nearbyPreviewPts.length > 0 ? (
              <div className="mb-3 space-y-1 text-center">
                <p className="text-[12px] font-semibold text-slate-800">
                  {t("public.orderExperience.nearbyDefaultCaption", { km: nearbyPreviewRadiusKm })}
                </p>
                <p className="text-[11px] text-slate-600">
                  {t("public.orderExperience.nearbyCountsHint", {
                    km: nearbyPreviewRadiusKm,
                    count: nearbyPreviewPts.length,
                  })}
                </p>
              </div>
            ) : null}
            {awaitingCaptainAssignment &&
            delayed3Minutes &&
            nearbyPreviewRadiusKm === SUCCESS_WAIT_NEARBY_EXPANDED_KM &&
            captainsNearbyAtFive === 0 ? (
              <p className="mb-3 rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2 text-center text-[12px] font-medium leading-relaxed text-amber-950">
                {t("public.orderExperience.waitingExpandedNearbyHint")}
              </p>
            ) : null}
            {mapLeafletPoints.length > 0 ? (
              <PublicTrackingLeaflet className="h-[260px] w-full rounded-2xl border border-white/70" points={mapLeafletPoints} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--brand-border)] bg-white/80 p-6 text-center text-[13px] text-slate-600">
                {t("public.orderExperience.mapAwaitCaptain")}
              </div>
            )}
            {live?.etaMinutes != null ? (
              <p className="mt-4 text-center text-sm font-semibold text-[color:var(--brand-primary-dark)]">
                {t("public.orderExperience.etaSentence", {
                  minutes: live.etaMinutes,
                  suffix:
                    live.etaPhase === "to_pickup"
                      ? t("public.orderExperience.etaToPickup")
                      : live.etaPhase === "to_dropoff"
                        ? t("public.orderExperience.etaToDropoff")
                        : "",
                })}
              </p>
            ) : null}
            <div className="mt-5 rounded-2xl border border-white/60 bg-white p-5">
              <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-900">
                {t("public.orderExperience.stagesHeading")}
              </p>
              <ul className="space-y-1.5">
                {PUBLIC_SUCCESS_TIMELINE.map((stepKey, idx) => (
                  <li
                    key={stepKey}
                    className={idx <= statusIndex ? "font-semibold text-primary" : "text-[13px] text-slate-500"}
                  >
                    <span dir="ltr" className="inline-block font-mono text-[11px] text-slate-400">
                      {idx + 1}.
                    </span>{" "}
                    {t(`public.orderExperience.${TIMELINE_I18N_KEY[stepKey]}`)}
                  </li>
                ))}
              </ul>
              {live?.captain ? (
                <p className="mt-6 text-[13px] text-slate-700">
                  {t("public.orderExperience.captainLine")}{" "}
                  <span className="font-semibold">{live.captain.displayName}</span>
                  {(live.captain.phone ?? "").trim() !== "" ? (
                    <>
                      {" "}
                      — <span dir="ltr">{live.captain.phone}</span>
                    </>
                  ) : live.captain.awaitingCaptainAcceptance ? (
                    <span className="block text-[12px] text-slate-500">
                      {t("public.orderExperience.captainAwaitingApp")}
                    </span>
                  ) : null}
                </p>
              ) : receipt.captainName ? (
                <p className="mt-6 text-[13px] text-slate-700">
                  {t("public.orderExperience.captainLine")}{" "}
                  <span className="font-semibold">{receipt.captainName}</span>
                  {receipt.captainPhone ? (
                    <>
                      {" "}
                      — <span dir="ltr">{receipt.captainPhone}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="mt-6 text-[13px] text-slate-600">{t("public.orderExperience.captainSearching")}</p>
              )}
              {live?.captain && (live.captain.phone ?? "").trim() !== "" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${String(live.captain.phone).replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--brand-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[color:var(--brand-primary-dark)] hover:bg-[color:var(--brand-light-primary)]"
                  >
                    <Phone className="size-4" aria-hidden />
                    {t("public.orderExperience.callCaptain")}
                  </a>
                  {digitsForWhatsApp(live.captain.phone) ? (
                    <a
                      href={`https://wa.me/${digitsForWhatsApp(live.captain.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      {t("public.orderExperience.whatsappCaptain")}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewOrder}
            className="mt-8 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-sm hover:bg-[color:var(--brand-primary-dark)]"
          >
            {t("public.newRequest")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function hasCoordsUi(lat?: number | null, lng?: number | null): boolean {
  return Number.isFinite(lat ?? NaN) && Number.isFinite(lng ?? NaN);
}

function CaptainAvailabilityBanner({
  state,
}: {
  state: "FOUND" | "NONE" | "BLOCKED";
}) {
  const { t } = useTranslation();
  if (state === "FOUND") {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {t("public.orderExperience.captainAvailFound")}
      </div>
    );
  }
  if (state === "BLOCKED") {
    return (
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {t("public.orderExperience.captainAvailBlocked")}
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-slate-600">
      {t("public.orderExperience.captainAvailNone")}
    </div>
  );
}

function buildReceipt(
  created: PublicCreateOrderResult,
  extra: {
    storeNum: number;
    feePreview: number;
    pickupLatitude?: number;
    pickupLongitude?: number;
    ownerCode: string;
  },
): ReceiptState {
  const feeStr = created.deliveryFee ?? extra.feePreview.toFixed(2);
  const computedCollect =
    parseMoneyInput(extra.storeNum.toFixed(2)) + parseMoneyInput(feeStr);
  const serverCollect =
    typeof created.cashCollection === "string" && created.cashCollection.trim() !== ""
      ? parseMoneyInput(created.cashCollection.trim())
      : NaN;
  const collectStr = Number.isFinite(serverCollect)
    ? serverCollect.toFixed(2)
    : computedCollect.toFixed(2);
  return {
    orderNumber: created.orderNumber,
    status: created.status,
    store: extra.storeNum.toFixed(2),
    fee: feeStr,
    collect: collectStr,
    pickupAddress: created.pickupAddress,
    dropoffAddress: created.dropoffAddress,
    captainName: created.assignedCaptain?.user?.fullName ?? null,
    captainPhone: created.assignedCaptain?.user?.phone ?? null,
    orderId: created.id,
    ownerCode: extra.ownerCode,
    trackingToken: created.publicTrackingToken ?? null,
    ...(Number.isFinite(extra.pickupLatitude) ? { pickupLatitude: extra.pickupLatitude } : {}),
    ...(Number.isFinite(extra.pickupLongitude) ? { pickupLongitude: extra.pickupLongitude } : {}),
  };
}
