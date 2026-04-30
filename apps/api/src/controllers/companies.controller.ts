import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import {
  createCompanyForSuperAdmin,
  listActiveCompaniesForSuperAdmin,
  updateCompanyForSuperAdmin,
} from "../services/companies.service.js";
import { archiveCompany, getCompanyDeletePreview } from "../services/company-archive.service.js";
import {
  readPublicPageSettingsResolved,
  replacePublicPageCarouselSlidesForCompany,
} from "../services/company-public-page.service.js";
import type { PublicPageCarouselSlidesPatch } from "../services/public-page-settings.js";

type CompanyParams = { companyId: string };

export const companiesController = {
  /** قراءة إعداد صفحة الطلب العامة لشركة — SUPER_ADMIN */
  publicPageSettings: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const data = await readPublicPageSettingsResolved(companyId);
    return res.json(ok(data));
  },

  /** سليكر صور صفحة الطلب — SUPER_ADMIN؛ يُستبدل المصفوفة بالكامل */
  patchPublicPageCarousel: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const body = req.body as PublicPageCarouselSlidesPatch;
    const data = await replacePublicPageCarouselSlidesForCompany({ companyId, patch: body });
    return res.json(ok(data));
  },

  list: async (_req: Request, res: Response) => {
    const data = await listActiveCompaniesForSuperAdmin();
    return res.json(ok(data));
  },

  create: async (req: Request, res: Response) => {
    const body = req.body as {
      name: string;
      incubatorMotherName?: string;
      deliveryPricing: {
        deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
        fixedDeliveryFee?: number;
        baseDeliveryFee?: number;
        pricePerKm?: number;
        deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      };
    };
    const data = await createCompanyForSuperAdmin({
      name: body.name,
      incubatorMotherName: body.incubatorMotherName,
      deliveryPricing: body.deliveryPricing,
    });
    return res.status(201).json(ok(data));
  },

  update: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const body = req.body as {
      name?: string;
      incubatorMotherName?: string | null;
      deliveryPricing?: {
        deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
        fixedDeliveryFee?: number;
        baseDeliveryFee?: number;
        pricePerKm?: number;
        deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
      };
    };
    const data = await updateCompanyForSuperAdmin(companyId, body);
    return res.json(ok(data));
  },

  deletePreview: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const data = await getCompanyDeletePreview(companyId);
    return res.json(ok(data));
  },

  archive: async (req: Request, res: Response) => {
    const { companyId } = req.params as CompanyParams;
    const body = req.body as { confirmPhrase?: string };
    const data = await archiveCompany(companyId, { confirmPhrase: body?.confirmPhrase });
    return res.json(ok(data));
  },
};
