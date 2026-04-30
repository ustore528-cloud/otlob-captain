import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import {
  mergeCarouselSlidesStoredJson,
  mergePublicPageStoredJson,
  resolvePublicPageSettings,
  type PublicPageCarouselSlidesPatch,
  type PublicPageSettingsPatch,
  type ResolvedPublicPageSettings,
} from "./public-page-settings.js";

export async function readPublicPageSettingsResolved(companyId: string): Promise<ResolvedPublicPageSettings> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { publicPageSettings: true },
  });
  return resolvePublicPageSettings(row?.publicPageSettings ?? null);
}

export async function updatePublicPageSettingsForCompany(opts: {
  companyId: string;
  patch: PublicPageSettingsPatch;
}): Promise<ResolvedPublicPageSettings> {
  const company = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { id: true },
  });
  if (!company) throw new AppError(404, "Company not found", "NOT_FOUND");

  const prev = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { publicPageSettings: true },
  });

  const merged = mergePublicPageStoredJson(prev?.publicPageSettings ?? null, opts.patch);

  await prisma.company.update({
    where: { id: opts.companyId },
    data: { publicPageSettings: merged as Prisma.InputJsonValue },
  });

  const row = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { publicPageSettings: true },
  });
  return resolvePublicPageSettings(row?.publicPageSettings ?? null);
}

/**
 * SUPER_ADMIN فقط — يستبدل شرائح السليكر المصوّرة لشركة؛ روابط HTTPS فقط.
 */
export async function replacePublicPageCarouselSlidesForCompany(opts: {
  companyId: string;
  patch: PublicPageCarouselSlidesPatch;
}): Promise<ResolvedPublicPageSettings> {
  const company = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { id: true },
  });
  if (!company) throw new AppError(404, "Company not found", "NOT_FOUND");

  const prev = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { publicPageSettings: true },
  });

  const normalized = opts.patch.carouselSlides.map((s, i) => ({
    id: s.id.trim() !== "" ? s.id : `slide-${i + 1}`,
    imageUrl: s.imageUrl.trim(),
    alt: (s.alt ?? "").trim(),
  }));

  const merged = mergeCarouselSlidesStoredJson(prev?.publicPageSettings ?? null, normalized);

  await prisma.company.update({
    where: { id: opts.companyId },
    data: { publicPageSettings: merged as Prisma.InputJsonValue },
  });

  const row = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { publicPageSettings: true },
  });
  return resolvePublicPageSettings(row?.publicPageSettings ?? null);
}
