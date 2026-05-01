import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Smartphone, UserPlus } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomerOrderPwaMeta } from "@/hooks/customer-order-pwa-meta";
import { isRtlLang } from "@/i18n/i18n";
import brandWordmark from "@/assets/brand-2in.png";

/** Safe PWA launcher entry — no dashboard links; directs users back to SMS / WhatsApp ordering links. */
export function CustomerOrderLandingPage() {
  const { t, i18n } = useTranslation();
  useCustomerOrderPwaMeta();
  const rtl = isRtlLang(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
        <div className="flex items-start justify-between gap-3">
          <img src={brandWordmark} alt="2in" className="h-9 w-auto object-contain" loading="lazy" />
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" className="gap-2 rounded-2xl font-bold shadow-sm" asChild>
            <Link to="/join-captain">
              <UserPlus className="size-5 shrink-0" aria-hidden />
              {t("captainJoin.customerCta")}
            </Link>
          </Button>
          <p className="text-xs text-slate-500 sm:max-w-[16rem]">{t("captainJoin.customerCtaHint")}</p>
        </div>

        <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700">
                <Smartphone className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl leading-snug text-slate-900">
                  {t("public.customerLanding.title")}
                </CardTitle>
                <CardDescription className="mt-2 text-base leading-relaxed text-slate-600">
                  {t("public.customerLanding.intro")}
                </CardDescription>
              </div>
            </div>

            <ul className="list-disc space-y-2 ps-10 text-sm text-slate-700">
              <li>{t("public.customerLanding.bulletLink")}</li>
              <li>{t("public.customerLanding.bulletTrack")}</li>
              <li>{t("public.customerLanding.bulletNotify")}</li>
            </ul>

            <p className="rounded-2xl bg-sky-50/80 px-4 py-3 text-sm leading-relaxed text-sky-950">
              {t("public.customerLanding.pwaInstallHint")}
            </p>

            <p className="text-xs leading-relaxed text-slate-500">{t("public.customerLanding.disclaimerAdmin")}</p>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
