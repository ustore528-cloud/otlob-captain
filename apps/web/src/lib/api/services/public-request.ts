import { apiFetch, paths } from "@/lib/api/http";

export type PublicRequestContext = {
  ownerCode: string | null;
  company: { id: string; name: string };
  companyAdmin: { fullName: string };
  zones: Array<{ id: string; name: string; cityName: string }>;
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
  deliveryFee?: number;
  cashCollection?: number;
  notes?: string;
  zoneId?: string;
};

export function createPublicOrder(body: PublicCreateOrderBody): Promise<unknown> {
  return apiFetch(paths.public.orders, { method: "POST", body: JSON.stringify(body) });
}
