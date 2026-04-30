/**
 * Phase D static RBAC verification (no DB required).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasCapability, type Capability } from "../src/rbac/permissions.js";
import {
  isManagementAdminRole,
  isStoreAdminRole,
  isSupportedPlatformActorRole,
  type AppRole,
} from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEGACY_ROLES: AppRole[] = [
  "BRANCH_MANAGER",
  "CAPTAIN_SUPERVISOR",
  "STORE_ADMIN",
  "STORE_USER",
  "DISPATCHER",
  "CUSTOMER",
  "ADMIN",
  "STORE",
];

const CAPABILITIES: Capability[] = [
  "users.read",
  "users.create",
  "users.toggleActive",
  "orders.read",
  "orders.create",
  "orders.dispatch",
  "captains.read",
  "captains.manage",
  "stores.read",
  "stores.manage",
  "finance.read",
  "finance.write",
  "reports.read",
  "settings.read",
  "settings.write",
];

function main(): void {
  for (const legacy of LEGACY_ROLES) {
    for (const capability of CAPABILITIES) {
      assert.equal(
        hasCapability(legacy, capability),
        false,
        `legacy role ${legacy} must not have capability ${capability}`,
      );
    }
  }

  assert.equal(isManagementAdminRole("ADMIN"), false, "ADMIN must not be treated as management admin");
  assert.equal(isStoreAdminRole("STORE"), true, "STORE legacy helper remains compatibility-only");
  assert.equal(isSupportedPlatformActorRole("SUPER_ADMIN"), true);
  assert.equal(isSupportedPlatformActorRole("COMPANY_ADMIN"), true);
  assert.equal(isSupportedPlatformActorRole("CAPTAIN"), true);
  assert.equal(isSupportedPlatformActorRole("DISPATCHER"), false);
  assert.equal(isSupportedPlatformActorRole("BRANCH_MANAGER"), false);

  const seedText = readFileSync(path.resolve(__dirname, "../prisma/seed.ts"), "utf8");
  for (const disallowed of [
    "$Enums.UserRole.DISPATCHER",
    "$Enums.UserRole.STORE_ADMIN",
    "$Enums.UserRole.STORE_USER",
    "$Enums.UserRole.BRANCH_MANAGER",
    "$Enums.UserRole.CAPTAIN_SUPERVISOR",
  ]) {
    assert.equal(seedText.includes(disallowed), false, `seed must not create ${disallowed}`);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, script: "verify-phase-d-rbac", at: new Date().toISOString() }, null, 2));
}

main();
