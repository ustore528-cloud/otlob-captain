import { paths } from "@/lib/api";
import { apiFetch } from "@/lib/api/http";

export type CaptainApplicationStatus =
  | "PENDING"
  | "REVIEWING"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED_TO_CAPTAIN";

export type CaptainApplicationAvailability = "FULL_TIME" | "PART_TIME";

export type CaptainJoinApplicationPayload = {
  fullName: string;
  primaryPhone: string;
  whatsappPhone: string;
  dateOfBirth?: string | "";
  ageYears?: number | null;
  city: string;
  fullAddress: string;
  languagesSpoken: string[];
  vehicleType: string;
  vehicleNumber?: string | "";
  preferredWorkAreas: string;
  canEnterJerusalem: boolean;
  canEnterInterior: boolean;
  availability: CaptainApplicationAvailability;
  notes?: string | "";
};

export async function submitCaptainJoinApplication(
  payload: CaptainJoinApplicationPayload,
): Promise<{ id: string; status: CaptainApplicationStatus; createdAt: string }> {
  return apiFetch<{ id: string; status: CaptainApplicationStatus; createdAt: string }>(
    paths.public.captainApplications,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export type CaptainApplicationListItem = {
  id: string;
  fullName: string;
  primaryPhone: string;
  whatsappPhone: string;
  dateOfBirth: string | null;
  ageYears: number | null;
  city: string;
  fullAddress: string;
  languagesSpoken: unknown;
  vehicleType: string;
  vehicleNumber: string | null;
  preferredWorkAreas: string;
  canEnterJerusalem: boolean;
  canEnterInterior: boolean;
  availability: CaptainApplicationAvailability;
  notes: string | null;
  status: CaptainApplicationStatus;
  internalNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy: { id: string; fullName: string; phone: string } | null;
};

export async function fetchCaptainApplicationsList(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    status?: CaptainApplicationStatus | "ALL";
    q?: string;
  },
): Promise<{ applications: CaptainApplicationListItem[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams();
  if (typeof params.page === "number") q.set("page", String(params.page));
  if (typeof params.pageSize === "number") q.set("pageSize", String(params.pageSize));
  if (params.status && params.status !== "ALL") q.set("status", params.status);
  if (params.q && params.q.trim()) q.set("q", params.q.trim());
  const qs = q.toString();
  const url = qs.length > 0 ? `${paths.adminCaptainApplications.root}?${qs}` : paths.adminCaptainApplications.root;
  return apiFetch<{ applications: CaptainApplicationListItem[]; total: number; page: number; pageSize: number }>(
    url,
    { token, method: "GET" },
  );
}

export async function patchCaptainApplicationAdmin(
  token: string,
  id: string,
  body: {
    status: CaptainApplicationStatus;
    internalNotes?: string | undefined;
  },
): Promise<CaptainApplicationListItem> {
  return apiFetch<CaptainApplicationListItem>(paths.adminCaptainApplications.status(id), {
    token,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
