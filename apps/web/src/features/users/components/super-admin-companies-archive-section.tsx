import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompaniesForSuperAdmin } from "@/hooks";
import { SuperAdminCompanyArchiveModal } from "./super-admin-company-archive-modal";

type Props = {
  isSuperAdmin: boolean;
};

/** أرشفة الشركات — يظهر لـ SUPER_ADMIN فقط */
export function SuperAdminCompaniesArchiveSection({ isSuperAdmin }: Props) {
  const companiesQ = useCompaniesForSuperAdmin({ enabled: isSuperAdmin });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  if (!isSuperAdmin) return null;

  return (
    <>
      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">الشركات — أرشفة آمنة (مدير أعلى فقط)</CardTitle>
          <CardDescription>
            معاينة الاعتمادات ثم أرشفة الشركة (تعطيل فقط). لا حذف نهائي للمستخدمين أو الطلبات أو السجلات.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companiesQ.isLoading ? <p className="text-sm text-muted">جارٍ التحميل…</p> : null}
          {companiesQ.isError ? (
            <p className="text-sm text-red-600">{(companiesQ.error as Error).message}</p>
          ) : null}
          {companiesQ.data && companiesQ.data.length === 0 ? (
            <p className="text-sm text-muted">لا توجد شركات في القائمة النشطة.</p>
          ) : null}
          {companiesQ.data && companiesQ.data.length > 0 ? (
            <ul className="divide-y divide-card-border rounded-lg border border-card-border">
              {companiesQ.data.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelected({ id: c.id, name: c.name });
                      setOpen(true);
                    }}
                  >
                    أرشفة
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      <SuperAdminCompanyArchiveModal
        open={open}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        companyId={selected?.id ?? null}
        companyName={selected?.name}
      />
    </>
  );
}
