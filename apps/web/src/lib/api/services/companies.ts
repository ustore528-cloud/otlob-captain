import { apiFetch, paths } from "@/lib/api/http";

export type CompanyListItem = { id: string; name: string };

export function listCompanies(token: string): Promise<CompanyListItem[]> {
  return apiFetch<CompanyListItem[]>(paths.companies.root, { token });
}
