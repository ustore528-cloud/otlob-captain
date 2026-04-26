/**
 * Read-only: list captains with NULL createdByUserId and per-company COMPANY_ADMIN users.
 * No writes. Usage: npx tsx apps/api/scripts/report-legacy-captain-ownership.ts
 */
import "dotenv/config";
import { Prisma, WalletOwnerType, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const DEMO_EMAIL_HINTS = ["admin@example.com", "demo", "test@"] as const;
const DEMO_NAME_HINTS = ["مسؤول النظام", "System", "Admin"] as const;

function looksDemoOrSystem(params: { email: string | null; fullName: string; phone: string }): string | null {
  const e = (params.email ?? "").toLowerCase();
  if (DEMO_EMAIL_HINTS.some((h) => h !== "admin@example.com" && e.includes(h)))
    return "email matches demo/test hint";
  if (e === "admin@example.com") return "email=admin@example.com";
  if (params.fullName === "مسؤول النظام") return "fullName=مسؤول النظام";
  if (DEMO_NAME_HINTS.some((n) => n !== "مسؤول النظام" && params.fullName.includes(n)))
    return "fullName matches system hint";
  return null;
}

async function lastAuthLoginMap(userIds: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (userIds.length === 0) return m;
  const rows = await prisma.activityLog.findMany({
    where: { userId: { in: userIds }, action: "AUTH_LOGIN" },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const r of rows) {
    if (r.userId && !m.has(r.userId)) m.set(r.userId, r.createdAt.toISOString());
    if (m.size >= userIds.length) break;
  }
  // fill missing with per-user max query if needed
  for (const id of userIds) {
    if (m.has(id)) continue;
    const one = await prisma.activityLog.findFirst({
      where: { userId: id, action: "AUTH_LOGIN" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (one) m.set(id, one.createdAt.toISOString());
  }
  return m;
}

function dec(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

async function main() {
  const captains = await prisma.captain.findMany({
    where: { createdByUserId: null },
    include: {
      user: { select: { id: true, fullName: true, phone: true, email: true, role: true, isActive: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { companyId: "asc" },
  });

  const captainIds = captains.map((c) => c.id);
  const [orderCounts, walletRows] = await Promise.all([
    captainIds.length
      ? prisma.order.groupBy({
          by: ["assignedCaptainId"],
          where: { assignedCaptainId: { in: captainIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { assignedCaptainId: string | null; _count: { _all: number } }[]),
    captainIds.length
      ? prisma.walletAccount.findMany({
          where: { ownerType: WalletOwnerType.CAPTAIN, ownerId: { in: captainIds } },
          select: { ownerId: true, balanceCached: true, currency: true },
        })
      : Promise.resolve([]),
  ]);

  const countByCaptain = new Map<string, number>();
  for (const g of orderCounts) {
    if (g.assignedCaptainId) countByCaptain.set(g.assignedCaptainId, g._count._all);
  }
  const walletByCaptain = new Map(walletRows.map((w) => [w.ownerId, w]));

  const companyIds = [...new Set(captains.map((c) => c.companyId))];
  const adminsByCompany = new Map<string, Awaited<ReturnType<typeof listCompanyAdmins>>>();
  for (const cid of companyIds) {
    adminsByCompany.set(cid, await listCompanyAdmins(cid));
  }

  const allAdminIds = [...new Set([...adminsByCompany.values()].flat().map((u) => u.id))];
  const loginMap = await lastAuthLoginMap(allAdminIds);

  const out = {
    generatedAt: new Date().toISOString(),
    totalNullOwnerCaptains: captains.length,
    captains: captains.map((c) => {
      const w = walletByCaptain.get(c.id);
      return {
        captainId: c.id,
        displayName: c.user.fullName,
        captainUserPhone: c.user.phone,
        captainUserEmail: c.user.email,
        captainUserId: c.userId,
        companyId: c.companyId,
        companyName: c.company.name,
        isActive: c.isActive,
        availabilityStatus: c.availabilityStatus,
        userRole: c.user.role,
        assignedOrderCount: countByCaptain.get(c.id) ?? 0,
        prepaidBalance: dec(c.prepaidBalance),
        walletBalanceCached: w ? dec(w.balanceCached) : null,
        walletCurrency: w?.currency ?? null,
      };
    }),
    companyAdminsByCompany: Object.fromEntries(
      [...adminsByCompany.entries()].map(([cid, users]) => [
        cid,
        users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          companyId: u.companyId,
          createdAt: u.createdAt.toISOString(),
          lastAuthLogin: loginMap.get(u.id) ?? null,
          demoOrSystemNote: looksDemoOrSystem({ email: u.email, fullName: u.fullName, phone: u.phone }),
        })),
      ]),
    ),
    adminCountsByCompany: Object.fromEntries(
      companyIds.map((cid) => {
        const list = adminsByCompany.get(cid) ?? [];
        return [
          cid,
          {
            count: list.length,
            classification:
              list.length === 0 ? "zero" : list.length === 1 ? "exactly_one" : "multiple",
          },
        ];
      }),
    ),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
}

async function listCompanyAdmins(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, role: UserRole.COMPANY_ADMIN },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyId: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
