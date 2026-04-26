import type { Request, Response } from "express";
import { superAdminWalletTopupService } from "../services/super-admin-wallet-topup.service.js";
import { companyWalletService } from "../services/company-wallet.service.js";
import { ok } from "../utils/api-response.js";
import { requireIdempotencyKeyHeader } from "../utils/idempotency-key-header.js";
import { pathParam } from "../utils/path-params.js";

export const superAdminWalletsController = {
  topUpStore: async (req: Request, res: Response) => {
    const idempotencyKey = requireIdempotencyKeyHeader(req);
    const body = req.body as { amount: string; currency?: string };
    const data = await superAdminWalletTopupService.topUpStoreWallet({
      storeId: pathParam(req, "storeId"),
      amount: body.amount,
      idempotencyKey,
      createdByUserId: req.user!.id,
      currency: body.currency,
    });
    return res.status(200).json(ok(data));
  },

  topUpSupervisorUser: async (req: Request, res: Response) => {
    const idempotencyKey = requireIdempotencyKeyHeader(req);
    const body = req.body as { amount: string; currency?: string };
    const data = await superAdminWalletTopupService.topUpSupervisorUserWallet({
      userId: pathParam(req, "userId"),
      amount: body.amount,
      idempotencyKey,
      createdByUserId: req.user!.id,
      currency: body.currency,
    });
    return res.status(200).json(ok(data));
  },

  adjustSupervisorUser: async (req: Request, res: Response) => {
    const idempotencyKey = requireIdempotencyKeyHeader(req);
    const body = req.body as { amount: string; note: string; currency?: string };
    const data = await superAdminWalletTopupService.adjustSupervisorUserWallet({
      userId: pathParam(req, "userId"),
      amount: body.amount,
      note: body.note,
      idempotencyKey,
      createdByUserId: req.user!.id,
      currency: body.currency,
    });
    return res.status(200).json(ok(data));
  },

  topUpCompany: async (req: Request, res: Response) => {
    const u = req.user!;
    const body = req.body as { amount: string; reason: string; idempotencyKey: string; currency?: string };
    const data = await companyWalletService.superAdminTopUpCompanyWallet(
      { userId: u.id, role: u.role, companyId: u.companyId ?? null, branchId: u.branchId ?? null },
      {
        companyId: pathParam(req, "companyId"),
        amount: body.amount,
        idempotencyKey: body.idempotencyKey,
        reason: body.reason,
        currency: body.currency,
      },
    );
    return res.status(200).json(ok(data));
  },
};
