import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotificationItem } from "@/types/api";

type Props = {
  loading: boolean;
  latest: NotificationItem | undefined;
};

export function DashboardNotificationCard({ loading, latest }: Props) {
  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">آخر تنبيه</CardTitle>
        <CardDescription>أحدث إشعار في صندوقك</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {loading ? (
          <p className="text-muted">جارٍ التحميل…</p>
        ) : latest ? (
          <div className="grid gap-2 rounded-xl border border-card-border bg-background/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{latest.title}</span>
              {!latest.isRead ? <span className="text-xs text-primary">غير مقروء</span> : null}
            </div>
            <p className="text-muted leading-relaxed">{latest.body}</p>
            <p className="text-xs text-muted" dir="ltr">
              {new Date(latest.createdAt).toLocaleString("ar-SA")}
            </p>
          </div>
        ) : (
          <p className="text-muted">لا توجد إشعارات بعد.</p>
        )}
      </CardContent>
    </Card>
  );
}
