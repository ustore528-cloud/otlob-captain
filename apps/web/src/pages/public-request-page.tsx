import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  PublicRequestOrderExperience,
  PublicRequestSuccessStage,
  type ReceiptState,
} from "@/features/public-request/public-request-order-experience";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ApiError } from "@/lib/api/http";
import { getPublicRequestContext, type PublicRequestContext } from "@/lib/api/services/public-request";
import { isRtlLang } from "@/i18n/i18n";

export function PublicRequestPage() {
  const { t, i18n } = useTranslation();
  const { ownerCode } = useParams<{ ownerCode: string }>();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);

  const [ctx, setCtx] = useState<PublicRequestContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  useEffect(() => {
    if (!ownerCode?.trim()) {
      setLoadError(t("public.invalidLink"));
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await getPublicRequestContext(ownerCode.trim());
        if (!cancelled) {
          setCtx(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? e.message : t("public.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerCode, t]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 p-6" dir={rtl ? "rtl" : "ltr"}>
        <p className="text-slate-500">{t("public.loading")}</p>
      </div>
    );
  }

  if (loadError && !ctx) {
    return (
      <div className="mx-auto max-w-lg p-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="rounded-3xl border border-blue-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">{t("public.unavailableTitle")}</CardTitle>
            <CardDescription className="text-slate-600">{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!ctx || !ownerCode?.trim()) {
    return null;
  }

  if (done && receipt) {
    return (
      <PublicRequestSuccessStage
        receipt={receipt}
        rtl={rtl}
        onNewOrder={() => {
          setDone(false);
          setReceipt(null);
          setSubmissionError(null);
        }}
      />
    );
  }

  return (
    <PublicRequestOrderExperience
      ownerCode={ownerCode.trim()}
      ctx={ctx}
      bannerError={submissionError}
      onBannerConsumed={() => setSubmissionError(null)}
      onSuccess={(rec) => {
        setReceipt(rec);
        setDone(true);
        setSubmissionError(null);
      }}
      onSubmitError={(msg) => setSubmissionError(msg)}
    />
  );
}
