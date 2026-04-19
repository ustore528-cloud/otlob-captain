import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const SETTINGS_ID = "default" as const;

export async function getDashboardSettings() {
  return prisma.dashboardSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function patchDashboardSettings(data: Prisma.DashboardSettingsUpdateInput) {
  return prisma.dashboardSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      ...(data as Prisma.DashboardSettingsCreateInput),
    },
    update: data,
  });
}
