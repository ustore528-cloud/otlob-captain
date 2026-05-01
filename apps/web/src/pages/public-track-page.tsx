import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { fetchPublicOrderIdsByTrackingToken } from "@/lib/api/services/public-request";
import { ApiError } from "@/lib/api/http";
import { isRtlLang } from "@/i18n/i18n";

/**
 * Deep link from Web Push: `/track/:trackingToken` → resume on `/request/:ownerCode?track=1&...`
 */
export function PublicTrackPage() {
  const { trackingToken = "" } = useParams<{ trackingToken: string }>();
  const { t, i18n } = useTranslation();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof trackingToken === "string" ? trackingToken.trim() : "";
    let tok = raw;
    try {
      tok = decodeURIComponent(raw);
    } catch {
      tok = raw;
    }
    tok = tok.trim();
    if (!tok) {
      setError(t("public.invalidLink"));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = await fetchPublicOrderIdsByTrackingToken(tok);
        if (cancelled) return;
        const q = new URLSearchParams({
          track: "1",
          oid: ids.orderId,
          tok,
        });
        setTarget(`/request/${encodeURIComponent(ids.ownerCode)}?${q.toString()}`);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : t("public.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackingToken, t]);

  if (target) {
    return <Navigate to={target} replace />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="rounded-3xl border border-blue-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">{t("public.unavailableTitle")}</CardTitle>
            <CardDescription className="text-slate-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 p-6" dir={rtl ? "rtl" : "ltr"}>
      <p className="text-slate-500">{t("public.loading")}</p>
    </div>
  );
}
