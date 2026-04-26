import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../lib/rbac-roles.js";

export type BranchListItem = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
};

/**
 * Active branches the caller may use when creating staff/captain resources in their tenant.
 * SUPER_ADMIN: optional `companyId` filter; without it, returns all active branches (with company name for UI).
 * COMPANY_ADMIN / ADMIN: branches for their company.
 * BRANCH_MANAGER: at most their own branch.
 */
export async function listForStaff(
  actorUserId: string,
  query: { companyId?: string },
): Promise<BranchListItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, companyId: true, branchId: true, role: true },
  });
  if (!user) throw new AppError(401, "User not found", "UNAUTHORIZED");
  const role = user.role as AppRole;

  if (role === "BRANCH_MANAGER") {
    if (!user.companyId || !user.branchId) return [];
    const b = await prisma.branch.findFirst({
      where: { id: user.branchId, companyId: user.companyId, isActive: true },
      include: { company: { select: { name: true } } },
    });
    if (!b) return [];
    return [{ id: b.id, name: b.name, companyId: b.companyId, companyName: b.company.name }];
  }

  if (role === "SUPER_ADMIN") {
    const where: { isActive: true; companyId?: string } = { isActive: true };
    if (query.companyId) where.companyId = query.companyId;
    const rows = await prisma.branch.findMany({
      where,
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
      include: { company: { select: { name: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      companyId: b.companyId,
      companyName: b.company.name,
    }));
  }

  if (role === "COMPANY_ADMIN") {
    if (!user.companyId) {
      throw new AppError(403, "Company scope is required on your account (multi-tenant).", "TENANT_SCOPE_REQUIRED");
    }
    const rows = await prisma.branch.findMany({
      where: { companyId: user.companyId, isActive: true },
      orderBy: { name: "asc" },
      include: { company: { select: { name: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      companyId: b.companyId,
      companyName: b.company.name,
    }));
  }

  if (role === "ADMIN") {
    if (user.companyId) {
      const rows = await prisma.branch.findMany({
        where: { companyId: user.companyId, isActive: true },
        orderBy: { name: "asc" },
        include: { company: { select: { name: true } } },
      });
      return rows.map((b) => ({
        id: b.id,
        name: b.name,
        companyId: b.companyId,
        companyName: b.company.name,
      }));
    }
    const where: { isActive: true; companyId?: string } = { isActive: true };
    if (query.companyId) where.companyId = query.companyId;
    const rows = await prisma.branch.findMany({
      where,
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
      include: { company: { select: { name: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      companyId: b.companyId,
      companyName: b.company.name,
    }));
  }

  throw new AppError(403, "Forbidden", "FORBIDDEN");
}
