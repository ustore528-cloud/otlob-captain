import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationItem } from "@/types/api";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";

type Props = {
  loading: boolean;
  latest: NotificationItem | undefined;
};

export function DashboardNotificationCard({ loading, latest }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("dashboard.widgets.latestNotification.title")}</CardTitle>
        <CardDescription>{t("dashboard.widgets.latestNotification.description")}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {loading ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : latest ? (
          <div className="grid gap-2 rounded-xl border border-card-border bg-background/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {getLocalizedText(latest.title, {
                  lang,
                  mode: "generic",
                  valueTranslations: latest.displayI18n?.title,
                })}
              </span>
              {!latest.isRead ? <span className="text-xs text-primary">{t("dashboard.widgets.latestNotification.unread")}</span> : null}
            </div>
            <p className="text-muted leading-relaxed">
              {getLocalizedText(latest.body, {
                lang,
                mode: "address",
                valueTranslations: latest.displayI18n?.body,
              })}
            </p>
            <p className="text-xs text-muted" dir="ltr">
              {new Date(latest.createdAt).toLocaleString("ar-SA")}
            </p>
          </div>
        ) : (
          <p className="text-muted">{t("dashboard.widgets.latestNotification.empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
