import type { StoreSubscriptionType, User, UserRole } from "@prisma/client";
import { AppError } from "../utils/errors.js";

/** Supervisors (linked user) must be one of these roles — Phase B slice 2 */
const ALLOWED_SUPERVISOR_ROLES = new Set<UserRole>(["COMPANY_ADMIN", "BRANCH_MANAGER", "DISPATCHER"]);

type SupervisorEntity = "store" | "captain";

function assertSupervisorUserAllowedForEntity(
  supervisorUser: User,
  companyId: string,
  branchId: string,
  entity: SupervisorEntity,
): void {
  if (!supervisorUser.companyId || supervisorUser.companyId !== companyId) {
    const msg =
      entity === "store"
        ? "Supervisor must belong to the same company as the store"
        : "Supervisor must belong to the same company as the captain";
    throw new AppError(400, msg, "VALIDATION_ERROR");
  }
  if (!ALLOWED_SUPERVISOR_ROLES.has(supervisorUser.role)) {
    throw new AppError(400, "Supervisor user role is not allowed for this link", "VALIDATION_ERROR");
  }
  if (supervisorUser.branchId != null && supervisorUser.branchId !== branchId) {
    const msg =
      entity === "store"
        ? "When the supervisor has a branch, it must match the store branch"
        : "When the supervisor has a branch, it must match the captain branch";
    throw new AppError(400, msg, "VALIDATION_ERROR");
  }
}

/**
 * Optional captain ↔ supervisor: when `supervisorUser` is non-null, same rules as
 * a SUPERVISOR_LINKED store supervisor (company, branch, allowed roles).
 */
export function assertOptionalCaptainSupervisorLinkValid(args: {
  supervisorUser: User | null;
  captainCompanyId: string;
  captainBranchId: string;
}): void {
  if (args.supervisorUser == null) return;
  assertSupervisorUserAllowedForEntity(
    args.supervisorUser,
    args.captainCompanyId,
    args.captainBranchId,
    "captain",
  );
}

/**
 * Enforces same-company, branch rule, and role allowlist. Call after resolving
 * final `subscriptionType` and loading the supervisor user (if any).
 */
export function assertStoreSupervisorLinkValid(args: {
  subscriptionType: StoreSubscriptionType;
  /** Non-null when subscriptionType is SUPERVISOR_LINKED and a user id is set */
  supervisorUser: User | null;
  storeCompanyId: string;
  storeBranchId: string;
}): void {
  const { subscriptionType, supervisorUser, storeCompanyId, storeBranchId } = args;

  if (subscriptionType === "PUBLIC") {
    if (supervisorUser != null) {
      throw new AppError(400, "PUBLIC store must not have a supervisor link", "VALIDATION_ERROR");
    }
    return;
  }

  if (subscriptionType === "SUPERVISOR_LINKED") {
    if (supervisorUser == null) {
      throw new AppError(400, "SUPERVISOR_LINKED store requires a valid supervisor", "VALIDATION_ERROR");
    }
    assertSupervisorUserAllowedForEntity(supervisorUser, storeCompanyId, storeBranchId, "store");
  }
}
