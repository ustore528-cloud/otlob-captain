import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import {
  PublicRequestOrderExperience,
  PublicRequestSuccessStage,
  type ReceiptState,
} from "@/features/public-request/public-request-order-experience";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ApiError } from "@/lib/api/http";
import {
  fetchPublicOrderTracking,
  getPublicRequestContext,
  type PublicRequestContext,
} from "@/lib/api/services/public-request";
import { isRtlLang } from "@/i18n/i18n";

export function PublicRequestPage() {
  const { t, i18n } = useTranslation();
  const { ownerCode } = useParams<{ ownerCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);

  const [ctx, setCtx] = useState<PublicRequestContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [resumeAttempted, setResumeAttempted] = useState(false);
  const resumeQueryKey =
    `${searchParams.get("track") ?? ""}|${searchParams.get("oid") ?? ""}|${searchParams.get("tok") ?? ""}`;

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

  /** فتح متابعة من إشعار / رابط قصير: ?track=1&oid=…&tok=… */
  useEffect(() => {
    if (!ownerCode?.trim() || !ctx || resumeAttempted || done) return;
    const track = searchParams.get("track");
    const oid = searchParams.get("oid")?.trim();
    const tok = searchParams.get("tok")?.trim();
    if (track !== "1" || !oid || !tok) return;
    setResumeAttempted(true);
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicOrderTracking(ownerCode.trim(), oid, tok);
        if (cancelled) return;
        const h = data.receiptHints;
        const cap = data.captain;
        const feeStr = (h?.deliveryFee ?? "").trim() !== "" ? (h!.deliveryFee as string) : "0";
        setReceipt({
          orderNumber: h?.orderNumber ?? "—",
          status: data.status,
          store: h?.storeLabel ?? "—",
          fee: feeStr,
          collect: (h?.cashCollection ?? "").trim() !== "" ? h!.cashCollection : "0",
          pickupAddress: h?.pickupAddress ?? "",
          dropoffAddress: h?.dropoffAddress ?? "",
          captainName: cap?.displayName ?? null,
          captainPhone: cap?.phone ?? null,
          orderId: oid,
          ownerCode: ownerCode.trim(),
          trackingToken: tok,
        });
        setDone(true);
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev);
            p.delete("track");
            p.delete("oid");
            p.delete("tok");
            return p;
          },
          { replace: true },
        );
      } catch {
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev);
            p.delete("track");
            p.delete("oid");
            p.delete("tok");
            return p;
          },
          { replace: true },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, done, ownerCode, resumeAttempted, resumeQueryKey, setSearchParams]);

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
