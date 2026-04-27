import { prisma } from "../lib/prisma.js";

export type CompanyListItem = { id: string; name: string };

/** Active companies — SUPER_ADMIN company picker only. */
export async function listActiveCompaniesForSuperAdmin(): Promise<CompanyListItem[]> {
  const rows = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

/** إنشاء شركة نشطة — معرّف تلقائي من قاعدة البيانات */
export async function createCompanyForSuperAdmin(input: { name: string }): Promise<CompanyListItem> {
  const name = input.name.trim();
  return prisma.company.create({
    data: { name, isActive: true },
    select: { id: true, name: true },
  });
}
