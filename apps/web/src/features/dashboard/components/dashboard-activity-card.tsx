import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/types/api";

type Props = {
  dispatch: boolean;
  loading: boolean;
  items: ActivityItem[];
};

export function DashboardActivityCard({ dispatch, loading, items }: Props) {
  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Activity className="size-5 text-primary" />
        <div>
          <CardTitle className="text-base">ملخص النشاط</CardTitle>
          <CardDescription>آخر الأحداث التشغيلية (للمشغّل/المدير)</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {!dispatch ? (
          <p className="text-muted">يتوفر ملخص النشاط لحسابات الإدارة والتشغيل.</p>
        ) : loading ? (
          <p className="text-muted">جارٍ التحميل…</p>
        ) : (
          <ul className="grid gap-2">
            {items.map((a) => (
              <li key={a.id} className="rounded-lg border border-card-border bg-background/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{a.action}</span>
                  <span className="text-xs text-muted" dir="ltr">
                    {new Date(a.createdAt).toLocaleString("ar-SA")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {a.entityType} / <span className="font-mono">{a.entityId}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
