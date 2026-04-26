import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../lib/rbac-roles.js";
import { isSuperAdminRole } from "../lib/rbac-roles.js";

export type ZoneListItem = {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
};

/**
 * Active zones for a company (via City). Scoped like branches listing.
 */
export async function listZonesForStaff(actorUserId: string, query: { companyId?: string }): Promise<ZoneListItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, companyId: true, branchId: true, role: true },
  });
  if (!user) throw new AppError(401, "User not found", "UNAUTHORIZED");
  const role = user.role as AppRole;

  if (isSuperAdminRole(role)) {
    const where: { isActive: true; city?: { companyId: string } } = { isActive: true };
    if (query.companyId) where.city = { companyId: query.companyId };
    const rows = await prisma.zone.findMany({
      where,
      orderBy: [{ cityId: "asc" }, { name: "asc" }],
      include: { city: { select: { name: true } } },
    });
    return rows.map((z) => ({
      id: z.id,
      name: z.name,
      cityId: z.cityId,
      cityName: z.city.name,
    }));
  }

  if (role === "COMPANY_ADMIN") {
    if (!user.companyId) {
      throw new AppError(403, "Company scope is required on your account (multi-tenant).", "TENANT_SCOPE_REQUIRED");
    }
    const rows = await prisma.zone.findMany({
      where: { isActive: true, city: { companyId: user.companyId } },
      orderBy: [{ cityId: "asc" }, { name: "asc" }],
      include: { city: { select: { name: true } } },
    });
    return rows.map((z) => ({
      id: z.id,
      name: z.name,
      cityId: z.cityId,
      cityName: z.city.name,
    }));
  }

  if (role === "ADMIN") {
    if (user.companyId) {
      const rows = await prisma.zone.findMany({
        where: { isActive: true, city: { companyId: user.companyId } },
        orderBy: [{ cityId: "asc" }, { name: "asc" }],
        include: { city: { select: { name: true } } },
      });
      return rows.map((z) => ({
        id: z.id,
        name: z.name,
        cityId: z.cityId,
        cityName: z.city.name,
      }));
    }
    const where: { isActive: true; city?: { companyId: string } } = { isActive: true };
    if (query.companyId) where.city = { companyId: query.companyId };
    const rows = await prisma.zone.findMany({
      where,
      orderBy: [{ cityId: "asc" }, { name: "asc" }],
      include: { city: { select: { name: true } } },
    });
    return rows.map((z) => ({
      id: z.id,
      name: z.name,
      cityId: z.cityId,
      cityName: z.city.name,
    }));
  }

  if (role === "BRANCH_MANAGER") {
    if (!user.companyId || !user.branchId) return [];
    const b = await prisma.branch.findFirst({
      where: { id: user.branchId, companyId: user.companyId, isActive: true },
      select: { cityId: true, zoneId: true },
    });
    if (!b) return [];
    const where: { isActive: true; id?: string; cityId?: string } = { isActive: true };
    if (b.zoneId) where.id = b.zoneId;
    else if (b.cityId) where.cityId = b.cityId;
    else return [];
    const rows = await prisma.zone.findMany({
      where,
      orderBy: { name: "asc" },
      include: { city: { select: { name: true } } },
    });
    return rows.map((z) => ({
      id: z.id,
      name: z.name,
      cityId: z.cityId,
      cityName: z.city.name,
    }));
  }

  throw new AppError(403, "Forbidden", "FORBIDDEN");
}
