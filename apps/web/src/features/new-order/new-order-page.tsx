import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/page-header";
import { NewOrderForm } from "@/features/new-order/components/new-order-form";
import { isCompanyAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function NewOrderPageView() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const isCompanyAdmin = isCompanyAdminRole(role);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={isCompanyAdmin ? t("newOrder.page.titleCompany") : t("newOrder.page.title")}
        description={isCompanyAdmin ? t("newOrder.page.descriptionCompany") : t("newOrder.page.description")}
      />
      <NewOrderForm />
    </div>
  );
}
