import { prisma } from "../lib/prisma.js";

export const captainLocationRepository = {
  create(captainId: string, latitude: number, longitude: number) {
    return prisma.captainLocation.create({
      data: { captainId, latitude, longitude },
    });
  },

  async latestByCaptainIds(captainIds: string[]) {
    if (captainIds.length === 0) return [];
    const rows = await Promise.all(
      captainIds.map((captainId) =>
        prisma.captainLocation.findFirst({
          where: { captainId },
          orderBy: { recordedAt: "desc" },
        }),
      ),
    );
    return rows.filter((r): r is NonNullable<typeof r> => r != null);
  },
};
