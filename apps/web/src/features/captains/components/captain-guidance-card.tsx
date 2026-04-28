import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export function CaptainGuidanceCard() {
  const { t } = useTranslation();
  return (
    <Card className="border-card-border bg-accent/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("captains.guidance.title")}</CardTitle>
        <CardDescription>
          {t("captains.guidance.description")}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
