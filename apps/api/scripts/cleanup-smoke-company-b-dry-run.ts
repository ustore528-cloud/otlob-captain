/**
 * Read-only summary of "Smoke Company B" and related records for a future approved cleanup.
 * Does not modify the database. No --apply in this version.
 *
 *   npx tsx apps/api/scripts/cleanup-smoke-company-b-dry-run.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const SMOKE_COMPANY_ID = "cmob0w0bz0002umiweako63e2";
const SMOKE_COMPANY_NAME = "Smoke Company B";

async function main() {
  const company =
    (await prisma.company.findFirst({
      where: { OR: [{ id: SMOKE_COMPANY_ID }, { name: SMOKE_COMPANY_NAME }] },
    })) ?? null;
  if (!company) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ error: "Smoke company not found" }, null, 2));
    return;
  }
  const cid = company.id;
  const [users, captains, stores, orderCount, branchCount, walletCount] = await Promise.all([
    prisma.user.findMany({ where: { companyId: cid } }),
    prisma.captain.findMany({ where: { companyId: cid }, include: { user: { select: { fullName: true, email: true, phone: true } } } }),
    prisma.store.findMany({ where: { companyId: cid } }),
    prisma.order.count({ where: { companyId: cid } }),
    prisma.branch.count({ where: { companyId: cid } }),
    prisma.walletAccount.count({ where: { companyId: cid } }),
  ]);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        note: "Dry-run / inventory only. No deletions. Approve a dedicated cleanup --apply in a follow-up if desired.",
        company: { id: company.id, name: company.name, isActive: company.isActive, createdAt: company.createdAt },
        summary: {
          userCount: users.length,
          captainCount: captains.length,
          storeCount: stores.length,
          orderCount,
          branchCount,
          walletAccountCount: walletCount,
        },
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          phone: u.phone,
        })),
        captains: captains.map((c) => ({
          id: c.id,
          displayName: c.user.fullName,
          email: c.user.email,
          phone: c.user.phone,
          createdByUserId: c.createdByUserId,
        })),
        stores: stores.map((s) => ({ id: s.id, name: s.name, phone: s.phone })),
        classification: "Likely test/smoke: company name, smoke-prefixed emails, smoke captain naming — confirm with team before any cleanup.",
      },
      null,
      2,
    ),
  );
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
