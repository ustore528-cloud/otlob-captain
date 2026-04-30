/**
 * تأكيدات ثابتة لمرحلة A: القدرات + أدوار GET /orders (بدون قاعدة بيانات).
 */
import assert from "node:assert/strict";
import { rolesWithCapability } from "../src/rbac/permissions.js";
import {
  isOrderOperatorRole,
  isSupportedPlatformActorRole,
  type AppRole,
} from "../src/lib/rbac-roles.js";

function sortedJoin(roles: AppRole[]): string {
  return [...roles].sort().join("|");
}

function main(): void {
  assert.equal(
    sortedJoin(rolesWithCapability("orders.read")),
    sortedJoin(["SUPER_ADMIN", "COMPANY_ADMIN", "CAPTAIN"]),
    "orders.read must include only SUPER_ADMIN, COMPANY_ADMIN, CAPTAIN",
  );

  assert.equal(
    sortedJoin(rolesWithCapability("orders.create")),
    sortedJoin(["SUPER_ADMIN", "COMPANY_ADMIN"]),
    "orders.create only platform staff",
  );

  assert.equal(
    sortedJoin(rolesWithCapability("orders.dispatch")),
    sortedJoin(["SUPER_ADMIN", "COMPANY_ADMIN"]),
    "orders.dispatch only platform staff",
  );

  assert.equal(
    sortedJoin(rolesWithCapability("reports.read")),
    "SUPER_ADMIN",
    "reports only super admin",
  );

  assert.equal(
    sortedJoin(rolesWithCapability("captains.read")),
    sortedJoin(["SUPER_ADMIN", "COMPANY_ADMIN"]),
    "captain roster list not open to captain role via capability matrix",
  );

  assert.equal(isSupportedPlatformActorRole("SUPER_ADMIN"), true);
  assert.equal(isSupportedPlatformActorRole("COMPANY_ADMIN"), true);
  assert.equal(isSupportedPlatformActorRole("CAPTAIN"), true);
  assert.equal(isSupportedPlatformActorRole("DISPATCHER" as AppRole), false);
  assert.equal(isSupportedPlatformActorRole("STORE_ADMIN" as AppRole), false);

  assert.equal(isOrderOperatorRole("SUPER_ADMIN"), true);
  assert.equal(isOrderOperatorRole("COMPANY_ADMIN"), true);
  assert.equal(isOrderOperatorRole("ADMIN" as AppRole), false);
  assert.equal(isOrderOperatorRole("CAPTAIN"), false);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, script: "verify-phase-a-rbac", at: new Date().toISOString() }, null, 2));
}

main();
