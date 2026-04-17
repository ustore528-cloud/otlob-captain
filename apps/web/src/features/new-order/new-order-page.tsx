import { PageHeader } from "@/components/layout/page-header";
import { NewOrderForm } from "@/features/new-order/components/new-order-form";

export function NewOrderPageView() {
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title="طلب جديد"
        description="إدخال بيانات العميل والعناوين. موقع الخريطة اختياري؛ إن لم يُحدَّد يُعرَّف الموقع لاحقاً من تطبيق الكابتن."
      />
      <NewOrderForm />
    </div>
  );
}
