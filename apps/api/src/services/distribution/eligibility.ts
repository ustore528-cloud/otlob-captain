import { CaptainAvailabilityStatus, UserRole, type Prisma } from "@prisma/client";

/**
 * شروط التوزيع التلقائي (Round Robin):
 * - المستخدم: role = CAPTAIN, isActive = true
 * - ملف الكابتن: isActive = true, availabilityStatus = AVAILABLE
 */
export function eligibleCaptainsForAutoDistribution(): Prisma.CaptainWhereInput {
  return {
    isActive: true,
    availabilityStatus: CaptainAvailabilityStatus.AVAILABLE,
    user: {
      isActive: true,
      role: UserRole.CAPTAIN,
    },
  };
}

/** تعيين يدوي / سحب-وإفلات: كابتن فعّال بحساب CAPTAIN نشط (يسمح بتوفر غير AVAILABLE للتجاوز اليدوي) */
export function captainEligibleForManualOverride(captain: {
  isActive: boolean;
  availabilityStatus: CaptainAvailabilityStatus;
  user: { isActive: boolean; role: UserRole };
}): boolean {
  if (!captain.isActive || !captain.user.isActive) return false;
  if (captain.user.role !== UserRole.CAPTAIN) return false;
  return true;
}
