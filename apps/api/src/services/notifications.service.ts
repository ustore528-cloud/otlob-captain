import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { activityService } from "./activity.service.js";
import { isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { AppError } from "../utils/errors.js";
import { notificationDisplayI18nFromJson } from "../lib/display-i18n.js";

export type QuickStatusCode = "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";

const QUICK_STATUS_LABEL: Record<QuickStatusCode, string> = {
  PRESSURE: "ضغط",
  LOW_ACTIVITY: "حركة ضعيفة",
  RAISE_READINESS: "ارفع الجاهزية",
  ON_FIRE: "الوضع نار",
};

function isQuickStatusCode(v: string): v is QuickStatusCode {
  return v === "PRESSURE" || v === "LOW_ACTIVITY" || v === "RAISE_READINESS" || v === "ON_FIRE";
}

export const notificationService = {
  async create(userId: string, type: string, title: string, body: string, actorUserId?: string | null) {
    const row = await notificationRepository.create({
      user: { connect: { id: userId } },
      type,
      title,
      body,
    });
    if (actorUserId) {
      await activityService.log(actorUserId, "NOTIFICATION_CREATED", "notification", row.id, { targetUserId: userId });
    }
    return row;
  },

  async notifyCaptainTx(
    tx: Prisma.TransactionClient,
    captainUserId: string,
    type: string,
    title: string,
    body: string,
  ) {
    return tx.notification.create({
      data: { userId: captainUserId, type, title, body },
    });
  },

  async list(userId: string, params: { isRead?: boolean; page: number; pageSize: number }) {
    const [total, rows] = await notificationRepository.listForUser(userId, params);
    const items = rows.map((row) => {
      const displayI18n = notificationDisplayI18nFromJson(row.displayI18n ?? undefined);
      return {
        ...row,
        ...(displayI18n ? { displayI18n } : {}),
      };
    });
    return [total, items] as const;
  },

  markRead(id: string, userId: string) {
    return notificationRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },

  async sendQuickStatusAlert(
    status: QuickStatusCode,
    actor: {
      userId: string;
      role: AppRole;
      companyId: string | null;
    },
    options?: {
      /**
       * SUPER_ADMIN only:
       * - global=true => explicit global broadcast.
       * - targetCompanyId => company-scoped broadcast.
       */
      global?: boolean;
      targetCompanyId?: string;
    },
  ) {
    const label = QUICK_STATUS_LABEL[status];
    const globalRequested = options?.global === true;
    const targetCompanyId = options?.targetCompanyId ?? null;

    if (!isSuperAdminRole(actor.role)) {
      if (!actor.companyId) {
        throw new AppError(
          403,
          "Company scope is required on your account for quick status alerts.",
          "TENANT_SCOPE_REQUIRED",
        );
      }
      if (globalRequested) {
        throw new AppError(403, "Global broadcast is only allowed for super admin.", "FORBIDDEN");
      }
    }

    if (globalRequested && targetCompanyId) {
      throw new AppError(400, "Use either global or targetCompanyId, not both.", "INVALID_SCOPE");
    }
    if (isSuperAdminRole(actor.role) && !globalRequested && !targetCompanyId) {
      throw new AppError(
        400,
        "Super admin must set global=true or provide targetCompanyId.",
        "SCOPE_REQUIRED",
      );
    }

    const where: Prisma.CaptainWhereInput = {
      isActive: true,
      user: { isActive: true },
      ...(isSuperAdminRole(actor.role)
        ? globalRequested
          ? {}
          : { companyId: targetCompanyId ?? actor.companyId ?? undefined }
        : { companyId: actor.companyId! }),
    };

    const captains = await prisma.captain.findMany({
      where,
      select: { userId: true, companyId: true },
    });
    if (captains.length === 0) {
      await activityService.log(actor.userId, "QUICK_STATUS_ALERT", "notification", "none", {
        status,
        label,
        count: 0,
        scope: globalRequested ? "global" : "company",
        targetCompanyId: targetCompanyId ?? actor.companyId ?? null,
      });
      return { status, label, sent: 0 };
    }

    await prisma.notification.createMany({
      data: captains.map((c) => ({
        userId: c.userId,
        type: "QUICK_STATUS_ALERT",
        title: `تنبيه التشغيل: ${label}`,
        body: `حالة الشغل الآن: ${label}`,
      })),
    });
    await activityService.log(actor.userId, "QUICK_STATUS_ALERT", "notification", status, {
      status,
      label,
      count: captains.length,
      scope: globalRequested ? "global" : "company",
      targetCompanyId: targetCompanyId ?? actor.companyId ?? null,
    });
    return { status, label, sent: captains.length };
  },

  /**
   * Latest admin “quick work status” broadcast — from activity log (same source as dashboard alerts).
   */
  async getLatestQuickWorkStatus(): Promise<{
    active: boolean;
    code?: QuickStatusCode;
    label?: string;
    updatedAt?: string;
  }> {
    const row = await prisma.activityLog.findFirst({
      where: { action: "QUICK_STATUS_ALERT" },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      return { active: false };
    }
    const meta = row.metadata as { status?: string; label?: string } | null;
    const raw = meta?.status ?? row.entityId;
    if (!raw || raw === "none" || !isQuickStatusCode(raw)) {
      return { active: false };
    }
    const code = raw;
    const label = meta?.label ?? QUICK_STATUS_LABEL[code];
    return {
      active: true,
      code,
      label,
      updatedAt: row.createdAt.toISOString(),
    };
  },
};
