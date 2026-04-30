import type { PublicPageComplaintStatus } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { AppRole } from "../lib/rbac-roles.js";
import { isSuperAdminRole } from "../lib/rbac-roles.js";
import { AppError } from "../utils/errors.js";
import { prisma } from "../lib/prisma.js";

export async function submitPublicComplaintByOwnerCode(
  ownerCode: string,
  input: {
    customerName: string;
    customerPhone: string;
    complaintType: string;
    message: string;
  },
) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: ownerCode.trim(),
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    select: { companyId: true, company: { select: { isActive: true } } },
  });
  const companyId = admin?.companyId;
  const companyActive = admin?.company?.isActive ?? false;
  if (!companyId || !companyActive) {
    throw new AppError(404, "رابط الطلبات غير متاح أو غير مفعّل.", "PUBLIC_OWNER_NOT_FOUND");
  }

  return prisma.publicPageComplaint.create({
    data: {
      companyId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      complaintType: input.complaintType,
      message: input.message,
      status: "NEW",
    },
    select: { id: true, createdAt: true },
  });
}

export async function listComplaints(scope: {
  role: AppRole;
  companyId: string | null;
}) {
  if (!isSuperAdminRole(scope.role) && !scope.companyId) {
    return [];
  }
  const where = isSuperAdminRole(scope.role)
    ? {}
    : { companyId: scope.companyId as string };
  const rows = await prisma.publicPageComplaint.findMany({
    where,
    include: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.company.name,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    complaintType: r.complaintType,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function patchComplaintStatus(
  id: string,
  status: PublicPageComplaintStatus,
  scope: { role: AppRole; companyId: string | null },
) {
  if (!isSuperAdminRole(scope.role) && !scope.companyId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  const result = await prisma.publicPageComplaint.updateMany({
    where: {
      id,
      ...(isSuperAdminRole(scope.role)
        ? {}
        : { companyId: scope.companyId as string }),
    },
    data: { status },
  });
  if (result.count === 0) {
    if (
      !(await prisma.publicPageComplaint.findUnique({ where: { id }, select: { id: true } }))
    ) {
      throw new AppError(404, "Complaint not found", "NOT_FOUND");
    }
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  return { id, status };
}
