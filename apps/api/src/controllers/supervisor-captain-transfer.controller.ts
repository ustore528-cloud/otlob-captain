import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { transferSupervisorWalletToMyCaptain } from "../services/supervisor-captain-transfer.service.js";
import { ok } from "../utils/api-response.js";
import { requireIdempotencyKeyHeader } from "../utils/idempotency-key-header.js";
import { AppError } from "../utils/errors.js";

export const supervisorCaptainTransferController = {
  transferToMyCaptain: async (req: Request, res: Response) => {
    const role = req.user!.role as UserRole;
    if (role !== UserRole.SUPER_ADMIN && req.user!.companyId == null) {
      throw new AppError(400, "Company scope is required", "COMPANY_SCOPE_REQUIRED");
    }
    const idempotencyKey = requireIdempotencyKeyHeader(req);
    const body = req.body as { captainId: string; amount: string; currency?: string };
    const data = await transferSupervisorWalletToMyCaptain({
      actorUserId: req.user!.id,
      actorRole: role,
      actorCompanyId: req.user!.companyId ?? null,
      captainId: body.captainId,
      amount: body.amount,
      idempotencyKey,
      currency: body.currency,
    });
    return res.status(200).json(ok(data));
  },
};
