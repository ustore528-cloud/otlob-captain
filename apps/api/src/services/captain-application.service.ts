import {
  CaptainApplicationAvailability,
  CaptainApplicationStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import type { PublicCaptainApplicationCreateBody } from "../validators/captain-application.schemas.js";

function parseDateOnly(localYmd?: string | null): Date | undefined {
  if (!localYmd || localYmd.length !== 10) return undefined;
  const parts = localYmd.split("-");
  if (parts.length !== 3) return undefined;
  const y = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  const d = Number.parseInt(parts[2] ?? "", 10);
  if (
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    Number.isFinite(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31 &&
    y > 1900 &&
    y < 2100
  ) {
    return new Date(Date.UTC(y, m - 1, d));
  }
  return undefined;
}

export async function createCaptainApplication(input: PublicCaptainApplicationCreateBody) {
  const dateOfBirth = parseDateOnly(
    typeof input.dateOfBirth === "string" && input.dateOfBirth ? input.dateOfBirth : undefined,
  );
  const ageYears =
    typeof input.ageYears === "number" && Number.isFinite(input.ageYears) ? input.ageYears : null;

  if (!dateOfBirth && ageYears == null) {
    throw new AppError(400, "DATE_OR_AGE_REQUIRED", "Provide dateOfBirth or ageYears");
  }

  const vn =
    typeof input.vehicleNumber === "string" && input.vehicleNumber.trim() !== ""
      ? input.vehicleNumber.trim().slice(0, 64)
      : null;
  const notes =
    typeof input.notes === "string" && input.notes.trim() !== "" ? input.notes.trim() : null;

  const row = await prisma.captainApplication.create({
    data: {
      fullName: input.fullName.trim(),
      primaryPhone: input.primaryPhone.trim(),
      whatsappPhone: input.whatsappPhone.trim(),
      dateOfBirth: dateOfBirth ?? null,
      ageYears,
      city: input.city.trim(),
      fullAddress: input.fullAddress.trim(),
      languagesSpoken: [...input.languagesSpoken.map((x) => x.trim())] as unknown as Prisma.InputJsonValue,
      vehicleType: input.vehicleType.trim(),
      vehicleNumber: vn,
      preferredWorkAreas: input.preferredWorkAreas.trim(),
      canEnterJerusalem: Boolean(input.canEnterJerusalem),
      canEnterInterior: Boolean(input.canEnterInterior),
      availability: input.availability as CaptainApplicationAvailability,
      notes,
      status: CaptainApplicationStatus.PENDING,
    },
    select: { id: true, status: true, createdAt: true },
  });
  return row;
}

export type ListCaptainApplicationsQuery = {
  page: number;
  pageSize: number;
  status?: CaptainApplicationStatus | "ALL" | "";
  q?: string;
};

export async function listCaptainApplicationsForSuperAdmin(q: ListCaptainApplicationsQuery) {
  const skip = (q.page - 1) * q.pageSize;
  const rawStatus = q.status as CaptainApplicationStatus | "ALL" | undefined;
  const statusFilter =
    rawStatus && rawStatus !== "ALL" ? (rawStatus as CaptainApplicationStatus) : undefined;

  const trimmedQ = typeof q.q === "string" ? q.q.trim() : "";
  const or: Prisma.CaptainApplicationWhereInput[] = [];
  if (trimmedQ.length > 0) {
    const s = trimmedQ.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").slice(0, 200);
    or.push({ fullName: { contains: s, mode: "insensitive" } });
    or.push({ city: { contains: s, mode: "insensitive" } });
    or.push({ primaryPhone: { contains: trimmedQ } });
    or.push({ whatsappPhone: { contains: trimmedQ } });
    or.push({ preferredWorkAreas: { contains: s, mode: "insensitive" } });
  }

  const where: Prisma.CaptainApplicationWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(or.length ? { OR: or } : {}),
  };

  const [applications, total] = await prisma.$transaction([
    prisma.captainApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.pageSize,
      include: {
        reviewedBy: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.captainApplication.count({ where }),
  ]);

  return { applications, total, page: q.page, pageSize: q.pageSize };
}

export async function patchCaptainApplicationStatus(params: {
  id: string;
  status: CaptainApplicationStatus;
  internalNotes?: string | null | undefined;
  actorUserId: string;
}) {
  const existing = await prisma.captainApplication.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "APPLICATION_NOT_FOUND", "Captain application not found");

  const trimmedInternal =
    typeof params.internalNotes === "string"
      ? params.internalNotes.trim()
      : typeof params.internalNotes === "undefined"
        ? undefined
        : "";

  const merged = await prisma.captainApplication.update({
    where: { id: params.id },
    data: {
      status: params.status,
      reviewedByUserId: params.actorUserId,
      reviewedAt: new Date(),
      ...(trimmedInternal !== undefined
        ? {
            internalNotes:
              trimmedInternal === "" ? null : trimmedInternal.slice(0, 12000),
          }
        : {}),
    },
    include: {
      reviewedBy: { select: { id: true, fullName: true, phone: true } },
    },
  });
  return merged;
}
