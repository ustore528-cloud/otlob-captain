import { apiFetch, paths } from "@/lib/api/http";

export type PublicRequestContext = {
  ownerCode: string | null;
  company: { id: string; name: string };
  companyAdmin: { fullName: string };
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
};

export function createPublicOrder(body: PublicCreateOrderBody): Promise<PublicCreateOrderResult> {
  return apiFetch(paths.public.orders, { method: "POST", body: JSON.stringify(body) });
}
