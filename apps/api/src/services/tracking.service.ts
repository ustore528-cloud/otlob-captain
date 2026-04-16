import { CaptainAvailabilityStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { captainLocationRepository } from "../repositories/captain-location.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import { emitCaptainLocation } from "../realtime/hub.js";

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
      select: { id: true, area: true, availabilityStatus: true, user: { select: { fullName: true, phone: true } } },
    });
    const ids = captains.map((c) => c.id);
    const locs = await captainLocationRepository.latestByCaptainIds(ids);
    const locByCaptain = new Map(locs.map((l) => [l.captainId, l]));
    return captains.map((c) => ({
      ...c,
      lastLocation: locByCaptain.get(c.id) ?? null,
    }));
  },
};
