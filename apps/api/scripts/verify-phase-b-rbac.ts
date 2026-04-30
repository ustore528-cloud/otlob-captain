/**
 * تأكيدات ثابتة لمرحلة B: مسارات المحفظة/التحويل وPATCH الطلبيات.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rolesWithCapability } from "../src/rbac/permissions.js";
import type { AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "../src/routes/v1");

function readRoute(name: string): string {
  return readFileSync(path.join(routesDir, name), "utf8");
}

function sortedJoin(roles: AppRole[]): string {
  return [...roles].sort().join("|");
}

function main(): void {
  const transfer = readRoute("supervisor-captain-transfer.routes.ts");
  assert(transfer.includes("COMPANY_ADMIN") && transfer.includes("SUPER_ADMIN"), "supervisor transfer must allow COMPANY_ADMIN + SUPER_ADMIN");
  assert(!transfer.includes("BRANCH_MANAGER"), "supervisor transfer must not list BRANCH_MANAGER");
  assert(!transfer.includes("DISPATCHER"), "supervisor transfer must not list DISPATCHER");

  const wallet = readRoute("wallet-read.routes.ts");
  assert(!wallet.includes("LEGACY_STORE"), "wallet-read should not expose legacy STORE shorthand");
  assert(
    wallet.includes("SUPER_ADMIN") && wallet.includes("COMPANY_ADMIN") && !wallet.includes("STORE"),
    "finance ledger readers: super admin + company only; legacy STORE omitted",
  );

  const orders = readRoute("orders.routes.ts");
  assert(orders.includes("orderStatusPatchRoles"), "orders.routes must define orderStatusPatchRoles");
  assert(orders.includes(":id/status"), "PATCH status route present");
  assert(
    orders.includes("requireRoles(...orderStatusPatchRoles)") && orders.includes("\"CAPTAIN\""),
    "PATCH /status uses explicit SUPER/COMPANY/CAPTAIN",
  );

  assert.equal(
    sortedJoin(rolesWithCapability("orders.read")),
    sortedJoin(["SUPER_ADMIN", "COMPANY_ADMIN", "CAPTAIN"]),
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, script: "verify-phase-b-rbac", at: new Date().toISOString() }, null, 2));
}

main();
