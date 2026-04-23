import type { AppRole } from "../lib/rbac-roles.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: AppRole;
        storeId: string | null;
        companyId: string | null;
        branchId: string | null;
      };
    }
  }
}

export {};
