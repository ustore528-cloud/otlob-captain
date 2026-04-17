import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CaptainGuidanceCard() {
  return (
    <Card className="border-card-border bg-accent/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">إرشاد</CardTitle>
        <CardDescription>
          التفعيل يتحكم في دخول الكابتن للنظام؛ التوفر يُحدَّث من تطبيق الكابتن أو من لوحة التشغيل.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
