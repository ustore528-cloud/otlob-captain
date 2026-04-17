import { useState } from "react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { AddCaptainFormCard } from "@/features/captains/components/add-captain-form-card";
import { CaptainGuidanceCard } from "@/features/captains/components/captain-guidance-card";
import { CaptainEditModal } from "@/features/captains/components/captain-edit-modal";
import { CaptainOrdersReportModal } from "@/features/captains/components/captain-orders-report-modal";
import { CaptainsRosterCard } from "@/features/captains/components/captains-roster-card";
import { useAuthStore } from "@/stores/auth-store";
import type { CaptainListItem } from "@/types/api";

export function CaptainsPageView() {
  const role = useAuthStore((s) => s.user?.role);
  const [reportCap, setReportCap] = useState<CaptainListItem | null>(null);
  const [editCap, setEditCap] = useState<CaptainListItem | null>(null);

  const isAdmin = role === "ADMIN";

  if (role !== "ADMIN" && role !== "DISPATCHER") return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="الكباتن"
        description="إدارة الحسابات، التفعيل، التعديل، التقرير (طلبات مع فلترة)، وحذف نهائي للمدير عند عدم وجود طلبات نشطة."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <AddCaptainFormCard />
        <CaptainGuidanceCard />
      </div>

      <CaptainsRosterCard
        onOpenReport={setReportCap}
        onOpenEdit={setEditCap}
        canDelete={isAdmin}
      />

      <CaptainOrdersReportModal captain={reportCap} open={Boolean(reportCap)} onClose={() => setReportCap(null)} />
      <CaptainEditModal captain={editCap} open={Boolean(editCap)} onClose={() => setEditCap(null)} />
    </div>
  );
}
