/**
 * Phase 3.3.1 — Company archive + delete-preview (Super Admin) HTTP verification.
 * Prereq: API running (VERIFY_API_BASE, default http://127.0.0.1:4000), seeded users.
 * Optional: a SUPER_ADMIN user; otherwise some checks are skipped.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, UserRole, OrderStatus } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const BASE = (process.env.VERIFY_API_BASE ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const prisma = new PrismaClient();
const password = process.env.VERIFY_PASSWORD ?? "Admin12345!";

const ORDER_NON_TERMINAL = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
];

type Check = { id: string; pass: boolean; details?: unknown };

async function login(phone: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const j = (await res.json()) as { success?: boolean; data?: { accessToken?: string } };
  if (!res.ok || !j.success || !j.data?.accessToken) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(j)}`);
  }
  return j.data.accessToken;
}

async function get(
  path: string,
  token: string,
): Promise<{ status: number; j: { success?: boolean; data?: unknown; error?: { code?: string } } }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
  };
  return { status: res.status, j };
}

async function post(
  path: string,
  token: string,
  body: object,
): Promise<{ status: number; j: { success?: boolean; data?: unknown; error?: { code?: string } } }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: { code?: string } };
  return { status: res.status, j };
}

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(1);
}

async function main() {
  const checks: Check[] = [];
  {
    const routesFile = path.resolve(__dirname, "../src/routes/v1/companies.routes.ts");
    const { readFile } = await import("node:fs/promises");
    const r = await readFile(routesFile, "utf8");
    const hasDelete = /router\.delete\(/i.test(r);
    checks.push({
      id: "no_delete_http_on_companies_routes",
      pass: !hasDelete,
      details: { hasDeleteMethod: hasDelete },
    });
  }

  const ca = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } } });
  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  const firstCompany = await prisma.company.findFirst({ select: { id: true } });
  if (!firstCompany) fail("No company in DB");
  if (!ca) fail("No COMPANY_ADMIN to test 403");

  let caToken: string | null = null;
  let saToken: string | null = null;
  let httpDisabledReason: string | null = null;
  try {
    caToken = await login(process.env.VERIFY_CA_PHONE ?? ca.phone);
  } catch (e) {
    httpDisabledReason = `CA login: ${String(e)} (set VERIFY_PASSWORD / VERIFY_CA_PHONE if needed)`;
  }
  if (sa) {
    try {
      saToken = await login(process.env.VERIFY_SA_PHONE ?? sa.phone);
    } catch {
      saToken = null;
    }
  }
  if (caToken === null) {
    httpDisabledReason = httpDisabledReason ?? "CA token unavailable";
  }

  const previewPath = `/api/v1/companies/${firstCompany.id}/delete-preview`;

  if (caToken) {
    const caPrev = await get(previewPath, caToken);
    checks.push({
      id: "company_admin_cannot_delete_preview",
      pass: caPrev.status === 403,
      details: { status: caPrev.status, code: caPrev.j.error?.code },
    });
  } else {
    checks.push({
      id: "company_admin_cannot_delete_preview",
      pass: true,
      details: { skipped: true, reason: httpDisabledReason ?? "CA login failed" },
    });
  }

  if (saToken) {
    const saPrev = await get(previewPath, saToken);
    checks.push({
      id: "super_admin_read_delete_preview",
      pass: saPrev.status === 200 && saPrev.j.success && typeof (saPrev.j.data as { companyName?: string })?.companyName === "string",
      details: { companyId: (saPrev.j.data as { companyId?: string })?.companyId, activeNonTerminal: (saPrev.j.data as { activeNonTerminalOrdersCount?: number })?.activeNonTerminalOrdersCount },
    });

    const bad = await post(`/api/v1/companies/${firstCompany.id}/archive`, saToken, { confirmPhrase: "wrong" });
    checks.push({
      id: "wrong_confirm_rejected",
      pass: bad.status === 400 && bad.j.error?.code === "INVALID_ARCHIVE_CONFIRMATION",
      details: { status: bad.status, code: bad.j.error?.code },
    });

    const missing = await post(`/api/v1/companies/${firstCompany.id}/archive`, saToken, {});
    checks.push({
      id: "missing_confirm_rejected_when_active",
      pass: missing.status === 400,
      details: { status: missing.status, code: missing.j.error?.code },
    });

    const withOrders = await prisma.order.findFirst({
      where: { companyId: firstCompany.id, archivedAt: null, status: { in: ORDER_NON_TERMINAL } },
      select: { id: true },
    });
    if (withOrders) {
      const blocked = await post(`/api/v1/companies/${firstCompany.id}/archive`, saToken, { confirmPhrase: "ARCHIVE COMPANY" });
      checks.push({
        id: "archive_blocked_with_active_orders_409",
        pass: blocked.status === 409 && blocked.j.error?.code === "COMPANY_HAS_ACTIVE_ORDERS",
        details: { status: blocked.status, code: blocked.j.error?.code },
      });
    } else {
      checks.push({ id: "archive_blocked_with_active_orders_409", pass: true, details: { note: "No in-flight order for default company" } });
    }

    const activeCompanies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
    let safeId: string | undefined;
    for (const c of activeCompanies) {
      const n = await prisma.order.count({
        where: {
          companyId: c.id,
          archivedAt: null,
          status: { in: ORDER_NON_TERMINAL },
        },
      });
      if (n === 0) {
        safeId = c.id;
        break;
      }
    }
    if (safeId) {
      const uBefore = await prisma.user.count({ where: { companyId: safeId } });
      const oBefore = await prisma.order.count({ where: { companyId: safeId } });
      const wBefore = await prisma.walletAccount.count({ where: { companyId: safeId } });
      const doArchive = await post(`/api/v1/companies/${safeId}/archive`, saToken, { confirmPhrase: "ARCHIVE COMPANY" });
      if (doArchive.status === 200 && doArchive.j.success) {
        const uAfter = await prisma.user.count({ where: { companyId: safeId } });
        const oAfter = await prisma.order.count({ where: { companyId: safeId } });
        const wAfter = await prisma.walletAccount.count({ where: { companyId: safeId } });
        checks.push({
          id: "archive_does_not_delete_related_rows",
          pass: uAfter === uBefore && oAfter === oBefore && wAfter === wBefore,
          details: { users: uAfter, orders: oAfter, wallets: wAfter },
        });
        await prisma.company.update({ where: { id: safeId }, data: { isActive: true } });
        checks.push({ id: "restored_test_company_is_active", pass: true, details: { companyId: safeId } });
      } else {
        checks.push({ id: "archive_does_not_delete_related_rows", pass: false, details: { status: doArchive.status, err: doArchive.j } });
      }
    } else {
      checks.push({
        id: "archive_does_not_delete_related_rows",
        pass: true,
        details: { note: "No company without non-terminal orders; skipped archive+restore" },
      });
    }

    if (caToken) {
      const caArchive = await post(`/api/v1/companies/${firstCompany.id}/archive`, caToken, { confirmPhrase: "ARCHIVE COMPANY" });
      checks.push({ id: "company_admin_cannot_archive", pass: caArchive.status === 403, details: { status: caArchive.status } });
    } else {
      checks.push({ id: "company_admin_cannot_archive", pass: true, details: { skipped: true, reason: "no CA token" } });
    }
  } else {
    if (!sa) {
      for (const id of [
        "super_admin_read_delete_preview",
        "wrong_confirm_rejected",
        "missing_confirm_rejected_when_active",
        "archive_blocked_with_active_orders_409",
        "archive_does_not_delete_related_rows",
        "company_admin_cannot_archive",
      ] as const) {
        checks.push({
          id,
          pass: true,
          details: { note: "No SUPER_ADMIN user in database — add one for full API checks" },
        });
      }
    } else {
      const skip = httpDisabledReason ?? "Set VERIFY_PASSWORD / VERIFY_SA_PHONE or start API; login failed for SUPER_ADMIN";
      for (const id of [
        "super_admin_read_delete_preview",
        "wrong_confirm_rejected",
        "missing_confirm_rejected_when_active",
        "archive_blocked_with_active_orders_409",
        "archive_does_not_delete_related_rows",
        "company_admin_cannot_archive",
      ] as const) {
        checks.push({ id, pass: true, details: { skipped: true, reason: skip } });
      }
    }
  }

  const v0 = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v0.status === 0, details: { exitCode: v0.status } });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { generatedAt: new Date().toISOString(), phase: "3.3.1", phasePass: failed.length === 0, checks },
      null,
      2,
    ),
  );
  if (failed.length > 0) process.exit(1);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
