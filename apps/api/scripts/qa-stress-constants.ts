/**
 * Shared prefixes and regexes for QA-STRESS multitenant tooling (seed / verify / cleanup).
 * All synthetic rows must remain identifiable solely by these patterns.
 */

export const QA_STRESS_ORDER_PREFIX = "QA-STRESS-";
export const QA_STRESS_NOTES = "QA-STRESS-DO-NOT-PROCESS";
export const QA_STRESS_CUSTOMER_NAME = "QA-STRESS Customer";

/** Companies: QA-STRESS-Company-001 … */
export const QA_STRESS_COMPANY_NAME_RE = /^QA-STRESS-Company-\d{3}$/;

/** Branches: QA-STRESS-C001-Branch-001 */
export const QA_STRESS_BRANCH_NAME_RE = /^QA-STRESS-C\d{3}-Branch-\d{3}$/;

/** Stores: QA-STRESS-C001-B001-STORE */
export const QA_STRESS_STORE_NAME_RE = /^QA-STRESS-C\d{3}-B\d{3}-STORE$/;

/** Captains (user fullName): QA-STRESS-C001-Captain-001 */
export const QA_STRESS_CAPTAIN_NAME_RE = /^QA-STRESS-C\d{3}-Captain-\d{3}$/;

/** Company admin (user fullName): QA-STRESS-C001-CompanyAdmin */
export const QA_STRESS_COMPANY_ADMIN_RE = /^QA-STRESS-C\d{3}-CompanyAdmin$/;

/** Orders: QA-STRESS-C001-ORDER-0001 */
export const QA_STRESS_ORDER_NUMBER_RE = /^QA-STRESS-C\d{3}-ORDER-\d{4}$/;

export function companyCodeFromIndex(companyIndex1: number): string {
  return `C${String(companyIndex1).padStart(3, "0")}`;
}

export function companyName(companyIndex1: number): string {
  return `QA-STRESS-Company-${String(companyIndex1).padStart(3, "0")}`;
}

export function branchName(companyIndex1: number, branchIndex1: number): string {
  return `QA-STRESS-${companyCodeFromIndex(companyIndex1)}-Branch-${String(branchIndex1).padStart(3, "0")}`;
}

export function storeName(companyIndex1: number, branchIndex1: number): string {
  return `QA-STRESS-${companyCodeFromIndex(companyIndex1)}-B${String(branchIndex1).padStart(3, "0")}-STORE`;
}

export function captainFullName(companyIndex1: number, captainIndex1: number): string {
  return `QA-STRESS-${companyCodeFromIndex(companyIndex1)}-Captain-${String(captainIndex1).padStart(3, "0")}`;
}

export function companyAdminFullName(companyIndex1: number): string {
  return `QA-STRESS-${companyCodeFromIndex(companyIndex1)}-CompanyAdmin`;
}

export function orderNumber(companyIndex1: number, orderIndex1: number): string {
  return `QA-STRESS-${companyCodeFromIndex(companyIndex1)}-ORDER-${String(orderIndex1).padStart(4, "0")}`;
}

/** Riyadh-like base with deterministic spread by company / branch. */
export function coordsForCompanyBranch(companyIndex1: number, branchIndex1: number): {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
} {
  const baseLat = 24.7136 + (companyIndex1 - 1) * 0.02;
  const baseLng = 46.6753 + (branchIndex1 - 1) * 0.02 + (companyIndex1 - 1) * 0.003;
  return {
    pickupLat: baseLat,
    pickupLng: baseLng,
    dropoffLat: baseLat + 0.012,
    dropoffLng: baseLng + 0.015,
  };
}
