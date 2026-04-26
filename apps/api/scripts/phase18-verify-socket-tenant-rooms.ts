/**
 * Phase 1.8 verification: socket tenant room scoping behavior.
 * Read-only, no DB writes.
 */
import {
  canActorJoinCompanyRoom,
  requiresCompanyScopeForRealtime,
  resolveSocketJoinRooms,
  type RealtimeTenantActor,
} from "../src/realtime/socket-server.js";

type Check = {
  id: string;
  passed: boolean;
  details: Record<string, unknown>;
};

function actor(input: Partial<RealtimeTenantActor> & Pick<RealtimeTenantActor, "userId" | "role">): RealtimeTenantActor {
  return {
    userId: input.userId,
    role: input.role,
    storeId: input.storeId ?? null,
    companyId: input.companyId ?? null,
    branchId: input.branchId ?? null,
  };
}

async function main() {
  const companyA = "company_A";
  const companyB = "company_B";

  const companyAUser = actor({
    userId: "u_company_a",
    role: "COMPANY_ADMIN",
    companyId: companyA,
    branchId: "branch_A1",
  });
  const companyBUser = actor({
    userId: "u_company_b",
    role: "COMPANY_ADMIN",
    companyId: companyB,
    branchId: "branch_B1",
  });
  const noCompanyUser = actor({ userId: "u_missing_scope", role: "DISPATCHER" });
  const superAdmin = actor({ userId: "u_super", role: "SUPER_ADMIN" });
  const captainA = actor({ userId: "u_captain_a", role: "CAPTAIN", companyId: companyA, branchId: "branch_A1" });

  const checks: Check[] = [];

  // 1) Company A user cannot join Company B room.
  {
    const verdict = canActorJoinCompanyRoom(companyAUser, companyB);
    checks.push({
      id: "company_a_cannot_join_company_b_room",
      passed: verdict.allowed === false && verdict.code === "FORBIDDEN",
      details: { verdict },
    });
  }

  // 2) Company A user can join Company A room.
  {
    const verdict = canActorJoinCompanyRoom(companyAUser, companyA);
    checks.push({
      id: "company_a_can_join_company_a_room",
      passed: verdict.allowed === true,
      details: { verdict },
    });
  }

  // 3) User without companyId is blocked.
  {
    const verdict = canActorJoinCompanyRoom(noCompanyUser, companyA);
    checks.push({
      id: "missing_company_scope_blocked",
      passed:
        requiresCompanyScopeForRealtime(noCompanyUser.role) &&
        verdict.allowed === false &&
        verdict.code === "TENANT_SCOPE_REQUIRED",
      details: { verdict },
    });
  }

  // 4) Super Admin can join global room.
  {
    const rooms = resolveSocketJoinRooms(superAdmin);
    checks.push({
      id: "super_admin_joins_global_room",
      passed: rooms.includes("ops:global"),
      details: { rooms },
    });
  }

  // 5) Super Admin can join company room (supported by explicit join route).
  {
    const verdict = canActorJoinCompanyRoom(superAdmin, companyA);
    checks.push({
      id: "super_admin_can_join_company_room",
      passed: verdict.allowed === true,
      details: { verdict },
    });
  }

  // 6) Captains are scoped to own company where applicable.
  {
    const rooms = resolveSocketJoinRooms(captainA);
    const own = canActorJoinCompanyRoom(captainA, companyA);
    const other = canActorJoinCompanyRoom(captainA, companyB);
    checks.push({
      id: "captain_company_scope_enforced",
      passed:
        rooms.includes("captain:u_captain_a") &&
        rooms.includes("ops:company:company_A") &&
        own.allowed === true &&
        other.allowed === false &&
        other.code === "FORBIDDEN",
      details: { rooms, own, other },
    });
  }

  // Additional sanity: company B user stays scoped to B.
  {
    const rooms = resolveSocketJoinRooms(companyBUser);
    checks.push({
      id: "company_b_user_rooms_scoped",
      passed: rooms.some((r) => r.includes("company:company_B")) && !rooms.some((r) => r.includes("company:company_A")),
      details: { rooms },
    });
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.length - passedChecks;

  const payload = {
    generatedAt: new Date().toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    checks,
    databaseWritesPerformed: false,
    phasePass: failedChecks === 0,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.phasePass) process.exitCode = 1;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
