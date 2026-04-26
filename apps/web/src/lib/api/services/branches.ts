import { apiFetch, paths } from "@/lib/api/http";

export type BranchListItem = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
};

export function listBranches(token: string, q: { companyId?: string } = {}): Promise<BranchListItem[]> {
  const p = new URLSearchParams();
  if (q.companyId) p.set("companyId", q.companyId);
  const suffix = p.toString() ? `?${p.toString()}` : "";
  return apiFetch<BranchListItem[]>(`${paths.branches.root}${suffix}`, { token });
}
