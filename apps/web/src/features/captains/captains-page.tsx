import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { AddCaptainFormCard } from "@/features/captains/components/add-captain-form-card";
import { CaptainGuidanceCard } from "@/features/captains/components/captain-guidance-card";
import { CaptainEditModal } from "@/features/captains/components/captain-edit-modal";
import { CaptainOrdersReportModal } from "@/features/captains/components/captain-orders-report-modal";
import { CaptainsRosterCard } from "@/features/captains/components/captains-roster-card";
import { canAccessCaptainsPage, canChargeCaptainBalance, isManagementAdminRole, isSuperAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { CaptainListItem } from "@/types/api";

export function CaptainsPageView() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [reportCap, setReportCap] = useState<CaptainListItem | null>(null);
  const [editCap, setEditCap] = useState<CaptainListItem | null>(null);

  const canManageCaptains = isManagementAdminRole(role);
  const canCharge = canChargeCaptainBalance(role);
  const canDelete = isSuperAdminRole(role);

  if (!canAccessCaptainsPage(role)) return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("captains.page.title")}
        description={t("captains.page.description")}
        divider
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {canManageCaptains ? <AddCaptainFormCard /> : null}
        <CaptainGuidanceCard />
      </div>

      <CaptainsRosterCard
        onOpenReport={setReportCap}
        onOpenEdit={canManageCaptains ? setEditCap : () => {}}
        canManage={canManageCaptains && canCharge}
        canDelete={canDelete}
      />

      <CaptainOrdersReportModal captain={reportCap} open={Boolean(reportCap)} onClose={() => setReportCap(null)} />
      <CaptainEditModal captain={editCap} open={Boolean(editCap)} onClose={() => setEditCap(null)} />
    </div>
  );
}
