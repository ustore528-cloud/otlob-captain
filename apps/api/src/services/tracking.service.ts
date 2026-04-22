import {
  AssignmentResponseStatus,
  CaptainAvailabilityStatus,
  OrderStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { captainLocationRepository } from "../repositories/captain-location.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import { env } from "../config/env.js";
import { emitCaptainLocation } from "../realtime/hub.js";
import { clampOfferExpiredAtToConfiguredWindow } from "./distribution/clamp-offer-expired-at.js";
import { logOfferPayloadTrackingMapDiagnostics } from "./distribution/offer-diagnostics.js";
import { CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES } from "./distribution/eligibility.js";

export const trackingService = {
  async updateLocation(userId: string, latitude: number, longitude: number) {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

    const loc = await captainLocationRepository.create(captain.id, latitude, longitude);
    await prisma.captain.update({
      where: { id: captain.id },
      data: { lastSeenAt: new Date() },
    });
    await activityService.log(userId, "CAPTAIN_LOCATION", "captain", captain.id, { latitude, longitude });
    emitCaptainLocation({
      captainId: captain.id,
      userId,
      latitude,
      longitude,
      recordedAt: loc.recordedAt.toISOString(),
    });
    return loc;
  },

  async latestLocations(captainIds: string[]) {
    return captainLocationRepository.latestByCaptainIds(captainIds);
  },

  /** كباتن نشطون مع آخر موقع مسجل */
  async activeCaptainsMap() {
    const captains = await prisma.captain.findMany({
      where: {
        isActive: true,
        availabilityStatus: {
          in: [CaptainAvailabilityStatus.AVAILABLE, CaptainAvailabilityStatus.ON_DELIVERY, CaptainAvailabilityStatus.BUSY],
        },
        user: { isActive: true },
      },
      select: {
        id: true,
        userId: true,
        area: true,
        availabilityStatus: true,
        vehicleType: true,
        /** `id` يطابق `userId` — احتياطي للواجهة عند كاش قديم يفتقد `userId` */
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });
    const ids = captains.map((c) => c.id);
    const locs = await captainLocationRepository.latestByCaptainIds(ids);
    const locByCaptain = new Map(locs.map((l) => [l.captainId, l]));
    const assigned = await prisma.order.findMany({
      where: {
        assignedCaptainId: { in: ids },
        status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
      },
      select: { assignedCaptainId: true, orderNumber: true, status: true },
      orderBy: { createdAt: "desc" },
    });
    const metaByCaptain = new Map<
      string,
      { waitingOffers: number; activeOrders: number; latestOrderNumber: string | null; latestOrderStatus: string | null }
    >();
    for (const row of assigned) {
      const cid = row.assignedCaptainId;
      if (!cid) continue;
      const meta = metaByCaptain.get(cid) ?? {
        waitingOffers: 0,
        activeOrders: 0,
        latestOrderNumber: null,
        latestOrderStatus: null,
      };
      if (row.status === "ASSIGNED") meta.waitingOffers += 1;
      if (row.status === "ACCEPTED" || row.status === "PICKED_UP" || row.status === "IN_TRANSIT") meta.activeOrders += 1;
      if (!meta.latestOrderNumber) {
        meta.latestOrderNumber = row.orderNumber;
        meta.latestOrderStatus = row.status;
      }
      metaByCaptain.set(cid, meta);
    }

    const since = new Date(Date.now() - 15 * 60 * 1000);
    const rejectRows = await prisma.orderAssignmentLog.groupBy({
      by: ["captainId"],
      where: {
        captainId: { in: ids },
        responseStatus: AssignmentResponseStatus.REJECTED,
        assignedAt: { gte: since },
      },
      _count: { _all: true },
    });
    const recentRejectsByCaptain = new Map(rejectRows.map((r) => [r.captainId, r._count._all]));

    const pendingExpiryLogs = await prisma.orderAssignmentLog.findMany({
      where: {
        captainId: { in: ids },
        responseStatus: AssignmentResponseStatus.PENDING,
        expiredAt: { not: null },
      },
      select: { captainId: true, expiredAt: true, assignedAt: true },
    });
    const earliestOfferExpiry = new Map<string, Date>();
    for (const row of pendingExpiryLogs) {
      if (!row.expiredAt) continue;
      const clamped = clampOfferExpiredAtToConfiguredWindow(row.assignedAt, row.expiredAt);
      if (!clamped) continue;
      const prev = earliestOfferExpiry.get(row.captainId);
      if (!prev || clamped < prev) {
        earliestOfferExpiry.set(row.captainId, clamped);
      }
    }

    return captains.map((c) => {
      const assignmentOfferExpiresAt = earliestOfferExpiry.get(c.id)?.toISOString() ?? null;
      if (env.OFFER_DIAGNOSTICS === "1") {
        logOfferPayloadTrackingMapDiagnostics({
          captainId: c.id,
          assignmentOfferExpiresAtIso: assignmentOfferExpiresAt,
        });
      }
      return {
        ...c,
        lastLocation: locByCaptain.get(c.id) ?? null,
        waitingOffers: metaByCaptain.get(c.id)?.waitingOffers ?? 0,
        activeOrders: metaByCaptain.get(c.id)?.activeOrders ?? 0,
        latestOrderNumber: metaByCaptain.get(c.id)?.latestOrderNumber ?? null,
        latestOrderStatus: metaByCaptain.get(c.id)?.latestOrderStatus ?? null,
        recentRejects: recentRejectsByCaptain.get(c.id) ?? 0,
        assignmentOfferExpiresAt,
      };
    });
  },
};
