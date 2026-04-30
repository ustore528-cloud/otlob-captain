import { apiFetch, paths } from "@/lib/api/http";

export type ReverseGeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

/** تحويل موقع الجهاز إلى عنوان قابل للقراءة (عبر السيرفر → Nominatim). */
export function reverseGeocodePickup(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  return apiFetch<ReverseGeocodeResult>(paths.public.reverseGeocode(lat, lng), { method: "GET" });
}

/** يطابق مجمّع السيرفر `resolvePublicPageSettings` */
export type ResolvedPublicPageSettings = {
  introTitle: string;
  introSubtitle: string | null;
  carouselSlides: Array<{
    id: string;
    imageUrl: string | null;
    alt: string;
    title: string;
    badge: string;
    emoji: string;
    centerBg: string;
  }>;
  showCarousel: boolean;
  showComplaintsBox: boolean;
  showBenefitsRow: boolean;
  bannerWelcome: string | null;
  nearbyCaption: string | null;
  nearbyRadiusKm: number;
  orderButtonHint: string | null;
};

export type PublicRequestContext = {
  ownerCode: string | null;
  company: { id: string; name: string };
  companyAdmin: { fullName: string };
  publicPage?: ResolvedPublicPageSettings;
  zones: Array<{ id: string; name: string; cityName: string }>;
  pricing: {
    mode: "FIXED" | "DISTANCE_BASED";
    fixedDeliveryFee: string | null;
    baseDeliveryFee: string | null;
    pricePerKm: string | null;
    roundingMode: "CEIL" | "ROUND" | "NONE";
    formulaHint: string | null;
    calculatedDeliveryFee: string;
  };
  captainAvailability: {
    totalAvailableBikeCaptains: number;
    radiusPlanKm: number[];
    maxSearchRadiusKm: number;
    zoneEligibleCounts: Array<{ zoneId: string; count: number }>;
  };
};

export function getPublicRequestContext(ownerCode: string): Promise<PublicRequestContext> {
  return apiFetch<PublicRequestContext>(paths.public.requestContext(ownerCode), { method: "GET" });
}

export type PublicCreateOrderBody = {
  ownerCode: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: number;
  cashCollection?: number;
  notes?: string;
  zoneId?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
};

export type PublicCreateOrderResult = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryFee: string | null;
  amount: string;
  cashCollection: string;
  pickupAddress: string;
  dropoffAddress: string;
  assignedCaptainId?: string | null;
  assignedCaptain?: null | {
    user?: { fullName?: string; phone?: string } | null;
  };
  /** لمتابعة حيّة من صفحة النجاح — يتوفر بعد `prisma generate` ومزامنة الـAPI */
  publicTrackingToken?: string | null;
};

export type NearbyCaptainsResult = {
  radiusKm: number;
  captains: Array<{
    ordinal: number;
    label: string;
    vehicleType: string;
    distanceKm: number;
    latitude: number;
    longitude: number;
    recordedAt: string;
  }>;
};

export function fetchNearbyCaptains(ownerCode: string, lat: number, lng: number, radiusKm?: number): Promise<NearbyCaptainsResult> {
  return apiFetch<NearbyCaptainsResult>(
    paths.public.nearbyCaptains(ownerCode, lat, lng, radiusKm),
    { method: "GET" },
  );
}

export type PublicOrderTrackingResult = {
  status: string;
  etaMinutes: number | null;
  etaPhase: "to_pickup" | "to_dropoff" | null;
  etaSource: string;
  captain: null | {
    displayName: string;
    phoneMasked: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
    awaitingCaptainAcceptance: boolean;
    wazeUrl: string | null;
  };
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
};

/** GET `/api/v1/public/order-tracking/:ownerCode/:orderId?token=...` via `paths.public.orderTracking`. */
export function fetchPublicOrderTracking(
  ownerCode: string,
  orderId: string,
  token: string,
): Promise<PublicOrderTrackingResult> {
  return apiFetch<PublicOrderTrackingResult>(paths.public.orderTracking(ownerCode, orderId, token), { method: "GET" });
}

export function createPublicOrder(body: PublicCreateOrderBody): Promise<PublicCreateOrderResult> {
  return apiFetch(paths.public.orders, { method: "POST", body: JSON.stringify(body) });
}

export type SubmitPublicComplaintBody = {
  customerName: string;
  customerPhone: string;
  complaintType: string;
  message: string;
};

export type SubmitPublicComplaintResult = {
  id: string;
  createdAt: string;
};

/** لا يستخدم JWT؛ `companyId` يُقرَأ من مسار الطلب بالسيرفر. */
export function submitPublicComplaint(
  ownerCode: string,
  body: SubmitPublicComplaintBody,
): Promise<SubmitPublicComplaintResult> {
  return apiFetch(paths.public.complaints(ownerCode), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
