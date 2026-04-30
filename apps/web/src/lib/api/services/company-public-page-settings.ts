import { paths } from "@captain/shared";
import { apiFetch } from "@/lib/api/http";
import type { ResolvedPublicPageSettings } from "@/lib/api/services/public-request";

export function getCompanyPublicPageSettings(token: string): Promise<ResolvedPublicPageSettings> {
  return apiFetch<ResolvedPublicPageSettings>(paths.companyPublicPageSettings.me, { method: "GET", token });
}

export function patchCompanyPublicPageSettings(
  token: string,
  body: Record<string, unknown>,
): Promise<ResolvedPublicPageSettings> {
  return apiFetch<ResolvedPublicPageSettings>(paths.companyPublicPageSettings.me, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
