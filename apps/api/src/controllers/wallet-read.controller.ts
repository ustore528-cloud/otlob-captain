import type { Request, Response } from "express";
import { walletReadService } from "../services/wallet-read.service.js";
import { companyWalletService } from "../services/company-wallet.service.js";
import { companyAdminStoreWalletTopupService } from "../services/company-admin-wallet-topup.service.js";
import { captainPrepaidBalanceService } from "../services/captain-prepaid-balance.service.js";
import { ok } from "../utils/api-response.js";
import { pathParam } from "../utils/path-params.js";
import { AppError } from "../utils/errors.js";
import type { AppRole } from "../lib/rbac-roles.js";

function actorFromReq(req: Request) {
  const u = req.user!;
  return {
    userId: u.id,
    role: u.role as AppRole,
    companyId: u.companyId ?? null,
    branchId: u.branchId ?? null,
  };
}

export const walletReadController = {
  getStoreWallet: async (req: Request, res: Response) => {
    const data = await walletReadService.getStoreBalance(pathParam(req, "storeId"), actorFromReq(req));
    return res.json(ok(data));
  },

  /**
   * POST `/finance/stores/:storeId/company-top-up` — Company Admin only; tenant-scoped to `req.user.companyId`.
   */
  companyAdminTopUpStore: async (req: Request, res: Response) => {
    const b = req.body as { amount: string; reason: string; idempotencyKey: string; currency?: string };
    const data = await companyAdminStoreWalletTopupService.topUpStoreWallet(actorFromReq(req), {
      storeId: pathParam(req, "storeId"),
      amount: b.amount,
      reason: b.reason,
      idempotencyKey: b.idempotencyKey,
      currency: b.currency,
    });
    return res.json(ok(data));
  },

  /**
   * POST `/finance/captains/:captainId/prepaid-charge` — idempotent charge (COMPANY_ADMIN or SUPER_ADMIN).
   * Legacy `POST /captains/:id/prepaid-charge` is unchanged.
   */
  financeCaptainPrepaidCharge: async (req: Request, res: Response) => {
    const b = req.body as { amount: string; reason: string; idempotencyKey: string };
    const u = req.user!;
    const data = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: { userId: u.id, role: u.role as AppRole, companyId: u.companyId ?? null, branchId: u.branchId ?? null },
      captainId: pathParam(req, "captainId"),
      amount: b.amount,
      reason: b.reason,
      idempotencyKey: b.idempotencyKey,
    });
    return res.status(data.idempotent ? 200 : 201).json(ok(data));
  },

  getCaptainWallet: async (req: Request, res: Response) => {
    const data = await walletReadService.getCaptainBalance(pathParam(req, "captainId"), actorFromReq(req));
    return res.json(ok(data));
  },

  getMySupervisorWallet: async (req: Request, res: Response) => {
    if (!req.user!.companyId) {
      throw new AppError(400, "Company scope is required", "COMPANY_SCOPE_REQUIRED");
    }
    const data = await walletReadService.getMySupervisorBalance(actorFromReq(req));
    return res.json(ok(data));
  },

  listLedgerHistory: async (req: Request, res: Response) => {
    const q = req.query as unknown as { offset: number; limit: number };
    const data = await walletReadService.listLedgerEntries(pathParam(req, "walletAccountId"), actorFromReq(req), {
      offset: q.offset ?? 0,
      limit: q.limit ?? 20,
    });
    return res.json(ok(data));
  },

  listLedgerActivityReport: async (req: Request, res: Response) => {
    const q = req.query as unknown as { from: string; to: string; offset: number; limit: number };
    const data = await walletReadService.listLedgerActivityReport(pathParam(req, "walletAccountId"), actorFromReq(req), {
      from: q.from,
      to: q.to,
      offset: q.offset ?? 0,
      limit: q.limit ?? 20,
    });
    return res.json(ok(data));
  },

  getMyCompanyWallet: async (req: Request, res: Response) => {
    const data = await companyWalletService.getCompanyWalletReadMe(actorFromReq(req));
    return res.json(ok(data));
  },

  getCompanyWalletById: async (req: Request, res: Response) => {
    const data = await companyWalletService.getCompanyWalletReadById(
      actorFromReq(req),
      pathParam(req, "companyId"),
    );
    return res.json(ok(data));
  },
};
