import { activityLogRepository } from "../repositories/activity-log.repository.js";

export const activityReadService = {
  list(params: { userId?: string; entityType?: string; entityId?: string; page: number; pageSize: number }) {
    return activityLogRepository.list(params);
  },
};
