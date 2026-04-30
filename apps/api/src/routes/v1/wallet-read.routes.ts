import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { walletReadController } from "../../controllers/wallet-read.controller.js";
import {
  CaptainIdWalletParamSchema,
  CompanyAdminStoreTopUpBodySchema,
  CompanyWalletCompanyIdParamSchema,
  FinanceCaptainPrepaidChargeBodySchema,
  LedgerActivityReportQuerySchema,
  LedgerHistoryQuerySchema,
  StoreIdWalletParamSchema,
  WalletAccountIdParamSchema,
} from "../../validators/wallet-read.schemas.js";
import { ROLE_GROUPS, type AppRole } from "../../lib/rbac-roles.js";

/** أدوار المعتمدة فقط لمطالبة محفظة متجر وسجل حساب؛ أدوار legacy لا تستخدم هذه المسارات. */
const financeLedgerReaders = ["SUPER_ADMIN", "COMPANY_ADMIN"] as const satisfies readonly AppRole[];

const router = Router();
router.use(authMiddleware);

/** `GET /company-wallet/me` must be registered before `/:companyId` or `me` is parsed as a cuid. */
router.get(
  "/company-wallet/me",
  requireRoles("COMPANY_ADMIN"),
  asyncHandler(walletReadController.getMyCompanyWallet.bind(walletReadController)),
);
router.get(
  "/company-wallet/:companyId",
  requireRoles("SUPER_ADMIN"),
  validate("params", CompanyWalletCompanyIdParamSchema),
  asyncHandler(walletReadController.getCompanyWalletById.bind(walletReadController)),
);

const storeBalanceRoles = financeLedgerReaders;

const captainBalanceRoles = ["SUPER_ADMIN", "COMPANY_ADMIN"] as const satisfies readonly AppRole[];

const supervisorMeRoles = [...ROLE_GROUPS.superAdmins] as const;

/** Same union as wallet reads; row-level check in service. */
const ledgerReadRoles = financeLedgerReaders;

router.post(
  "/stores/:storeId/company-top-up",
  requireRoles("COMPANY_ADMIN"),
  validate("params", StoreIdWalletParamSchema),
  validate("body", CompanyAdminStoreTopUpBodySchema),
  asyncHandler(walletReadController.companyAdminTopUpStore.bind(walletReadController)),
);

router.get(
  "/stores/:storeId/wallet",
  requireRoles(...storeBalanceRoles),
  validate("params", StoreIdWalletParamSchema),
  asyncHandler(walletReadController.getStoreWallet.bind(walletReadController)),
);

router.get(
  "/captains/:captainId/wallet",
  requireRoles(...captainBalanceRoles),
  validate("params", CaptainIdWalletParamSchema),
  asyncHandler(walletReadController.getCaptainWallet.bind(walletReadController)),
);

router.post(
  "/captains/:captainId/prepaid-charge",
  requireRoles("COMPANY_ADMIN", "SUPER_ADMIN"),
  validate("params", CaptainIdWalletParamSchema),
  validate("body", FinanceCaptainPrepaidChargeBodySchema),
  asyncHandler(walletReadController.financeCaptainPrepaidCharge.bind(walletReadController)),
);

router.get(
  "/wallets/supervisor/me",
  requireRoles(...supervisorMeRoles),
  asyncHandler(walletReadController.getMySupervisorWallet.bind(walletReadController)),
);

router.get(
  "/wallet-accounts/:walletAccountId/ledger-entries",
  requireRoles(...ledgerReadRoles),
  validate("params", WalletAccountIdParamSchema),
  validate("query", LedgerHistoryQuerySchema),
  asyncHandler(walletReadController.listLedgerHistory.bind(walletReadController)),
);

router.get(
  "/wallet-accounts/:walletAccountId/ledger-activity",
  requireRoles(...ledgerReadRoles),
  validate("params", WalletAccountIdParamSchema),
  validate("query", LedgerActivityReportQuerySchema),
  asyncHandler(walletReadController.listLedgerActivityReport.bind(walletReadController)),
);

export { router as walletReadRoutes };
