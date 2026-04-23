import type { Prisma } from "@prisma/client";

/**
 * Phase B slice 3 — read-path only: `store.subscriptionType` + `store.supervisorUser` on order payloads.
 * Shared across order queries and distribution/captain includes.
 */
export const orderStoreSupervisorUserSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  role: true,
  companyId: true,
  branchId: true,
} as const satisfies Prisma.UserSelect;

/** Phase A completion — `primaryRegion` summary on order-embedded store (and shared with standalone store API). */
export const storePrimaryRegionSummarySelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
} as const satisfies Prisma.RegionSelect;

/** `store: { include: ... }` for findUnique/create/update (all store scalars + supervisor) */
export const orderStoreInclude = {
  include: {
    supervisorUser: { select: orderStoreSupervisorUserSelect },
    primaryRegion: { select: storePrimaryRegionSummarySelect },
  },
} as const;

/** `store: { select: ... }` for list-style queries (existing list fields + B3 enrichment) */
export const orderStoreListSelect: Prisma.StoreSelect = {
  id: true,
  name: true,
  area: true,
  subscriptionType: true,
  supervisorUser: { select: orderStoreSupervisorUserSelect },
  primaryRegion: { select: storePrimaryRegionSummarySelect },
};
