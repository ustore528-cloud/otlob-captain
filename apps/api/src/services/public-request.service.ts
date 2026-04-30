import { UserRole, CaptainAvailabilityStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { ordersService } from "./orders.service.js";
import type { AppRole } from "../lib/rbac-roles.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { captainLocationRepository } from "../repositories/captain-location.repository.js";
import { resolvePublicPageSettings, type ResolvedPublicPageSettings } from "./public-page-settings.js";
import { osrmDrivingDurationMinutes } from "./osrm-route.service.js";
import { forwardGeocodeAddressLine } from "./geocode-nominatim.service.js";

function moneyToNumber(v: Prisma.Decimal | null | undefined): number {
  if (!v) return 0;
  const parsed = Number(v.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDistanceKm(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return normalizeDistanceKm(earthRadiusKm * c);
}

function applyDeliveryFeeRounding(
  rawFee: number,
  mode: "CEIL" | "ROUND" | "NONE",
): number {
  const safe = Number.isFinite(rawFee) ? Math.max(0, rawFee) : 0;
  if (mode === "CEIL") return Math.ceil(safe);
  if (mode === "ROUND") return Math.round(safe);
  return Number(safe.toFixed(2));
}

function resolveDeliveryFee(settings: {
  mode: "FIXED" | "DISTANCE_BASED";
  fixedDeliveryFee: number;
  baseDeliveryFee: number;
  pricePerKm: number;
  roundingMode: "CEIL" | "ROUND" | "NONE";
  pickup?: { lat: number; lng: number } | null;
  dropoff?: { lat: number; lng: number } | null;
}): { deliveryFee: number; distanceKm: number | null } {
  if (settings.mode === "FIXED") {
    return {
      deliveryFee: applyDeliveryFeeRounding(settings.fixedDeliveryFee, settings.roundingMode),
      distanceKm: null,
    };
  }
  if (!settings.pickup || !settings.dropoff) {
    throw new AppError(
      400,
      "لا يمكن احتساب رسوم التوصيل حسب المسافة دون إحداثيات الاستلام والتسليم.",
      "DISTANCE_COORDINATES_REQUIRED",
    );
  }
  const distanceKm = haversineKm(settings.pickup, settings.dropoff);
  const rawFee = settings.baseDeliveryFee + distanceKm * settings.pricePerKm;
  return {
    deliveryFee: applyDeliveryFeeRounding(rawFee, settings.roundingMode),
    distanceKm: Number(distanceKm.toFixed(3)),
  };
}

type ResolvedPricingSettings = {
  pricingMode: "FIXED" | "DISTANCE_BASED";
  fixedDeliveryFee: number;
  baseDeliveryFee: number;
  pricePerKm: number;
  roundingMode: "CEIL" | "ROUND" | "NONE";
};

async function loadCompanyPricingSettings(companyId: string): Promise<ResolvedPricingSettings> {
  try {
    const deliverySettings = await prisma.deliverySettings.findUnique({
      where: { companyId },
      select: {
        deliveryPricingMode: true,
        fixedDeliveryFee: true,
        baseDeliveryFee: true,
        pricePerKm: true,
        deliveryFeeRoundingMode: true,
        defaultDeliveryFee: true,
      },
    });
    const pricingMode = deliverySettings?.deliveryPricingMode ?? "FIXED";
    return {
      pricingMode,
      fixedDeliveryFee:
        moneyToNumber(deliverySettings?.fixedDeliveryFee) || moneyToNumber(deliverySettings?.defaultDeliveryFee),
      baseDeliveryFee: moneyToNumber(deliverySettings?.baseDeliveryFee),
      pricePerKm: moneyToNumber(deliverySettings?.pricePerKm),
      roundingMode: deliverySettings?.deliveryFeeRoundingMode ?? "CEIL",
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      const legacy = await prisma.deliverySettings.findUnique({
        where: { companyId },
        select: { defaultDeliveryFee: true },
      });
      return {
        pricingMode: "FIXED",
        fixedDeliveryFee: moneyToNumber(legacy?.defaultDeliveryFee),
        baseDeliveryFee: 0,
        pricePerKm: 0,
        roundingMode: "CEIL",
      };
    }
    throw error;
  }
}

export async function getRequestContextByOwnerCode(code: string) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: code,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    include: {
      company: { select: { id: true, name: true, isActive: true, publicPageSettings: true } },
    },
  });
  if (!admin?.companyId || !admin.company?.isActive) {
    throw new AppError(404, "رابط الطلبات غير متاح أو غير مفعّل.", "PUBLIC_OWNER_NOT_FOUND");
  }
  const zones = await prisma.zone.findMany({
    where: { isActive: true, city: { companyId: admin.companyId } },
    orderBy: [{ cityId: "asc" }, { name: "asc" }],
    include: { city: { select: { name: true } } },
  });
  const { pricingMode, fixedDeliveryFee, baseDeliveryFee, pricePerKm, roundingMode } = await loadCompanyPricingSettings(
    admin.companyId,
  );
  const availableBikeCaptains = await prisma.captain.findMany({
    where: {
      companyId: admin.companyId,
      isActive: true,
      availabilityStatus: "AVAILABLE",
      vehicleType: "بسكليت",
    },
    select: { zoneId: true },
  });
  const zoneEligibleCounts = zones.map((z) => ({
    zoneId: z.id,
    count: availableBikeCaptains.filter((c) => c.zoneId == null || c.zoneId === z.id).length,
  }));

  const publicPage: ResolvedPublicPageSettings = resolvePublicPageSettings(admin.company.publicPageSettings);

  return {
    ownerCode: admin.publicOwnerCode,
    company: { id: admin.company.id, name: admin.company.name },
    companyAdmin: { fullName: admin.fullName },
    publicPage,
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      cityName: z.city.name,
    })),
    pricing: {
      mode: pricingMode,
      fixedDeliveryFee: fixedDeliveryFee > 0 || pricingMode === "FIXED" ? fixedDeliveryFee.toFixed(2) : null,
      baseDeliveryFee: baseDeliveryFee > 0 || pricingMode === "DISTANCE_BASED" ? baseDeliveryFee.toFixed(2) : null,
      pricePerKm: pricePerKm > 0 || pricingMode === "DISTANCE_BASED" ? pricePerKm.toFixed(2) : null,
      roundingMode,
      formulaHint: pricingMode === "FIXED" ? "FIXED" : "baseDeliveryFee + (distanceKm × pricePerKm)",
      calculatedDeliveryFee: (pricingMode === "FIXED" ? fixedDeliveryFee : baseDeliveryFee).toFixed(2),
    },
    captainAvailability: {
      totalAvailableBikeCaptains: availableBikeCaptains.length,
      radiusPlanKm: [5, 7, 10],
      maxSearchRadiusKm: 10,
      zoneEligibleCounts,
    },
  };
}

export async function createOrderFromPublicPage(body: {
  ownerCode: string;
  storeId?: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: number;
  cashCollection?: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  deliveryFee?: number;
  notes?: string;
  distributionMode?: "AUTO" | "MANUAL";
  zoneId?: string;
}) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: body.ownerCode,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    select: { id: true, companyId: true, branchId: true },
  });
  if (!admin?.companyId) {
    throw new AppError(404, "رابط الطلبات غير متاح أو غير مفعّل.", "PUBLIC_OWNER_NOT_FOUND");
  }

  const actor = {
    userId: admin.id,
    role: "COMPANY_ADMIN" as AppRole,
    storeId: null as string | null,
    companyId: admin.companyId,
    branchId: admin.branchId ?? null,
  };
  const { pricingMode, fixedDeliveryFee, baseDeliveryFee, pricePerKm, roundingMode } = await loadCompanyPricingSettings(
    admin.companyId,
  );

  /** للتسعير حسب المسافة: نقاط إذا غابت أي منها على العميل تُكمَّل آلياً عبر Nominatim (سرّي على الخادم). */
  let pickupLatEffective = body.pickupLatitude;
  let pickupLngEffective = body.pickupLongitude;
  let dropoffLatEffective = body.dropoffLatitude;
  let dropoffLngEffective = body.dropoffLongitude;

  const pickupFinite =
    pickupLatEffective != null &&
    pickupLngEffective != null &&
    Number.isFinite(pickupLatEffective) &&
    Number.isFinite(pickupLngEffective);
  const dropoffFinite =
    dropoffLatEffective != null &&
    dropoffLngEffective != null &&
    Number.isFinite(dropoffLatEffective) &&
    Number.isFinite(dropoffLngEffective);

  if (pricingMode === "DISTANCE_BASED") {
    if (!pickupFinite) {
      const g = await forwardGeocodeAddressLine(body.pickupAddress);
      pickupLatEffective = g.lat;
      pickupLngEffective = g.lng;
    }
    if (!dropoffFinite) {
      const g = await forwardGeocodeAddressLine(body.dropoffAddress);
      dropoffLatEffective = g.lat;
      dropoffLngEffective = g.lng;
    }
  }

  // Public flow must never trust client-provided deliveryFee.
  const { deliveryFee: serverDerivedDeliveryFee } = resolveDeliveryFee({
    mode: pricingMode,
    fixedDeliveryFee,
    baseDeliveryFee,
    pricePerKm,
    roundingMode,
    pickup:
      pickupLatEffective != null && pickupLngEffective != null
        ? { lat: pickupLatEffective, lng: pickupLngEffective }
        : null,
    dropoff:
      dropoffLatEffective != null && dropoffLngEffective != null
        ? { lat: dropoffLatEffective, lng: dropoffLngEffective }
        : null,
  });

  const publicTrackingToken = randomUUID();
  const order = await ordersService.create(
    {
      storeId: body.storeId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      area: body.area,
      amount: body.amount,
      cashCollection: body.cashCollection,
      pickupLatitude: pickupLatEffective,
      pickupLongitude: pickupLngEffective,
      dropoffLatitude: dropoffLatEffective,
      dropoffLongitude: dropoffLngEffective,
      deliveryFee: serverDerivedDeliveryFee,
      notes: body.notes,
      distributionMode: body.distributionMode,
      zoneId: body.zoneId,
      publicTrackingToken,
    },
    actor,
  );
  return toPublicCreatedOrder(order);
}

function toPublicCreatedOrder(order: Awaited<ReturnType<typeof ordersService.create>>) {
  const ac = order.assignedCaptain as null | {
    user?: { fullName?: string; phone?: string } | null;
  };
  const token = (order as { publicTrackingToken?: string | null }).publicTrackingToken ?? null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryFee: order.deliveryFee?.toString() ?? null,
    amount: order.amount.toString(),
    cashCollection: order.cashCollection.toString(),
    pickupAddress: order.pickupAddress,
    dropoffAddress: order.dropoffAddress,
    publicTrackingToken: token,
    assignedCaptainId: order.assignedCaptainId,
    assignedCaptain: ac?.user
      ? { user: { fullName: ac.user.fullName ?? null, phone: ac.user.phone ?? null } }
      : null,
  };
}

const LOCATION_MAX_AGE_MS = 45 * 60 * 1000;

function toFiniteCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** كباتن المتاحون مع آخر موقع ضمن دائرة (عميل صفحة الطلب). لا يُعاد الاسم الكامل. */
export async function listNearbyCaptainsPublic(
  ownerCode: string,
  latitude: unknown,
  longitude: unknown,
  radiusKm: unknown = 5,
) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: ownerCode,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    select: { companyId: true },
  });
  if (!admin?.companyId) {
    throw new AppError(404, "رابط الطلبات غير متاح.", "PUBLIC_OWNER_NOT_FOUND");
  }
  const latNum = toFiniteCoord(latitude);
  const lngNum = toFiniteCoord(longitude);
  if (latNum == null || lngNum == null) {
    throw new AppError(400, "يجب تحديد نقطة مرجعية صالحة.", "BAD_COORDS");
  }

  let rRaw =
    radiusKm === undefined || radiusKm === null || radiusKm === ""
      ? 5
      : typeof radiusKm === "number"
        ? radiusKm
        : Number(radiusKm);
  if (!Number.isFinite(rRaw)) rRaw = 5;
  const r = Math.min(25, Math.max(2, rRaw));

  const refLat = latNum;
  const refLng = lngNum;

  const captains = await prisma.captain.findMany({
    where: {
      companyId: admin.companyId,
      isActive: true,
      availabilityStatus: CaptainAvailabilityStatus.AVAILABLE,
      user: { isActive: true },
    },
    select: {
      id: true,
      vehicleType: true,
      user: { select: { fullName: true } },
    },
  });
  const ids = captains.map((c) => c.id);
  const latest = await captainLocationRepository.latestByCaptainIds(ids);
  const cutoff = Date.now() - LOCATION_MAX_AGE_MS;

  type Row = {
    ordinal: number;
    label: string;
    vehicleType: string;
    distanceKm: number;
    latitude: number;
    longitude: number;
    recordedAt: string;
  };
  const out: Row[] = [];
  let ord = 1;
  for (const row of latest) {
    if (row.recordedAt.getTime() < cutoff) continue;
    const dist = haversineKm({ lat: refLat, lng: refLng }, { lat: row.latitude, lng: row.longitude });
    if (dist > r + 1e-6) continue;
    const cap = captains.find((c) => c.id === row.captainId);
    if (!cap) continue;
    const name = cap.user.fullName?.trim().split(/\s+/)[0] ?? "كابتن";
    out.push({
      ordinal: ord,
      label: `${name}`,
      vehicleType: cap.vehicleType,
      distanceKm: Number(dist.toFixed(2)),
      latitude: row.latitude,
      longitude: row.longitude,
      recordedAt: row.recordedAt.toISOString(),
    });
    ord += 1;
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return { radiusKm: r, captains: out };
}

function maskPhoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 4) return "••••";
  return `•••${d.slice(-4)}`;
}

function captainFirstWord(fullName: string | null | undefined): string {
  const t = (fullName ?? "").trim().split(/\s+/)[0];
  return t || "كابتن";
}

/** لمتابعة الطلب بدون JWT — يتطلّب رمزًا أُنشئ عند إنشاء الطلب من الصفحة العامة فقط */
export async function getPublicOrderTracking(ownerCode: string, orderId: string, trackingToken: string) {
  if (!trackingToken.trim()) throw new AppError(400, "رمز التتبع مطلوب.", "BAD_REQUEST");
  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: {
      assignedCaptain: {
        select: {
          id: true,
          user: { select: { fullName: true, phone: true } },
        },
      },
    },
  });
  if (!order) throw new AppError(404, "الطلب غير موجود.", "NOT_FOUND");
  if (order.orderPublicOwnerCode !== ownerCode || order.publicTrackingToken !== trackingToken.trim()) {
    throw new AppError(404, "الطلب غير موجود أو الرمز غير صالح.", "NOT_FOUND");
  }

  const loc =
    order.assignedCaptainId != null
      ? (
          await captainLocationRepository.latestByCaptainIds([order.assignedCaptainId])
        ).find((l) => l.captainId === order.assignedCaptainId) ?? null
      : null;
  const capPt =
    loc != null ? { lat: loc.latitude, lng: loc.longitude } : null;

  let etaMinutes: number | null = null;
  let etaPhase: "to_pickup" | "to_dropoff" | null = null;

  const pickupFine =
    typeof order.pickupLat === "number" &&
    typeof order.pickupLng === "number" &&
    Number.isFinite(order.pickupLat) &&
    Number.isFinite(order.pickupLng);
  const dropFine =
    typeof order.dropoffLat === "number" &&
    typeof order.dropoffLng === "number" &&
    Number.isFinite(order.dropoffLat) &&
    Number.isFinite(order.dropoffLng);

  if (capPt) {
    if ((order.status === OrderStatus.ASSIGNED || order.status === OrderStatus.ACCEPTED) && pickupFine) {
      etaPhase = "to_pickup";
      etaMinutes = await osrmDrivingDurationMinutes(capPt, {
        lat: order.pickupLat!,
        lng: order.pickupLng!,
      });
    }
    if ((order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.IN_TRANSIT) && dropFine) {
      etaPhase = "to_dropoff";
      etaMinutes = await osrmDrivingDurationMinutes(capPt, {
        lat: order.dropoffLat!,
        lng: order.dropoffLng!,
      });
    }
  }

  let captainPayload: null | {
    displayName: string;
    phoneMasked: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
    awaitingCaptainAcceptance: boolean;
    wazeUrl: string | null;
  } = null;

  if (loc && order.assignedCaptainId && order.status !== OrderStatus.CANCELLED) {
    const wazeUrl = `https://waze.com/ul?ll=${loc.latitude}%2C${loc.longitude}&navigate=yes`;
    if (order.status === OrderStatus.ASSIGNED) {
      captainPayload = {
        displayName: "مسند إلى كابتن — بانتظار القبول",
        phoneMasked: "—",
        latitude: loc.latitude,
        longitude: loc.longitude,
        recordedAt: loc.recordedAt.toISOString(),
        awaitingCaptainAcceptance: true,
        wazeUrl,
      };
    } else if (
      order.status === OrderStatus.ACCEPTED ||
      order.status === OrderStatus.PICKED_UP ||
      order.status === OrderStatus.IN_TRANSIT
    ) {
      captainPayload = {
        displayName: captainFirstWord(order.assignedCaptain?.user?.fullName ?? null),
        phoneMasked: maskPhoneDigits(order.assignedCaptain?.user?.phone ?? ""),
        latitude: loc.latitude,
        longitude: loc.longitude,
        recordedAt: loc.recordedAt.toISOString(),
        awaitingCaptainAcceptance: false,
        wazeUrl,
      };
    }
  }

  return {
    status: order.status,
    etaMinutes,
    etaPhase,
    etaSource: "osrm_route" as const,
    captain: captainPayload,
    pickupLat: order.pickupLat,
    pickupLng: order.pickupLng,
    dropoffLat: order.dropoffLat,
    dropoffLng: order.dropoffLng,
  };
}
