import { PageHeader } from "@/components/layout/page-header";
import { NewOrderForm } from "@/features/new-order/components/new-order-form";
import { isCompanyAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function NewOrderPageView() {
  const role = useAuthStore((s) => s.user?.role);
  const isCompanyAdmin = isCompanyAdminRole(role);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title={isCompanyAdmin ? "طلب شركة جديد" : "طلب جديد"}
        description={
          isCompanyAdmin
            ? "بيانات العميل ونقطة الاستلام وتفاصيل التسليم والمبالغ. الخريطة اختياريّة؛ وإن لم تُثبّت الموقع هنا فقد يتأكد الكابتن لاحقاً."
            : "إدخال بيانات العميل والعناوين. موقع الخريطة اختياري؛ إن لم يُحدَّد يُعرَّف الموقع لاحقاً من تطبيق الكابتن."
        }
      />
      <NewOrderForm />
    </div>
  );
}
